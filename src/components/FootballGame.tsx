import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  Play,
  Pause,
  Trophy,
  Info,
  Camera,
  Home,
  Shield,
  AlertTriangle,
  Flag,
  CornerDownRight,
  ArrowRight,
  Sparkles,
  Coins,
  Zap,
  RefreshCw,
  CheckCircle2,
  Flame,
  Target,
  X,
  ChevronRight,
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { createSoccerBallTexture, createGrassTexture } from '../utils/textures';
import { TeamCustomization } from '../types/game';
import { getPlayerById } from '../data/players';
import { listenToMatchRoom, updateMatchRoomState } from '../lib/firebase';

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type CameraMode = 'follow' | 'tv' | 'topDown';
export type MatchPeriod = '1st_half' | 'half_time' | '2nd_half' | 'extra_time' | 'penalties' | 'finished';

interface FootballGameProps {
  team?: TeamCustomization;
  mode?: 'match' | 'training' | 'multiplayer';
  multiplayerRoomId?: string;
  multiplayerRole?: 'host' | 'guest';
  opponentName?: string;
  opponentTeam?: TeamCustomization;
  trainingDrill?: string;
  initialPeriod?: MatchPeriod;
  onShowLoading?: () => void;
  onExitToMenu?: (abandoned: boolean, pScore: number, aScore: number) => void;
  onMatchComplete?: (result: 'win' | 'loss' | 'tie', pScore: number, aScore: number) => void;
  onGoalScored?: () => void;
  onTrainingReward?: (amount: number, reason: string) => void;
  onSwitchTrainingDrill?: (drill: string) => void;
  onOpenTrainingMenu?: () => void;
}

// 11v11 Lineup Definitions (4-3-3 System on Colossal 175m x 110m Monumental Pitch)
interface PlayerRole {
  id: number;
  name: string;
  role: string;
  isGoalkeeper?: boolean;
  isCaptain?: boolean;
  baseX: number;
  baseZ: number;
}

const HOME_LINEUP_BASE: PlayerRole[] = [
  { id: 0, name: 'Livaković', role: 'POR', isGoalkeeper: true, baseX: 0, baseZ: 80 },
  { id: 1, name: 'Molina', role: 'LD', baseX: 40, baseZ: 58 },
  { id: 2, name: 'Romero', role: 'DFC', baseX: 15, baseZ: 63 },
  { id: 3, name: 'Upamecano', role: 'DFC', baseX: -15, baseZ: 63 },
  { id: 4, name: 'Tagliafico', role: 'LI', baseX: -40, baseZ: 58 },
  { id: 5, name: 'Amrabat', role: 'MCD', baseX: 0, baseZ: 38 },
  { id: 6, name: 'Mac Allister', role: 'MC', baseX: 26, baseZ: 24 },
  { id: 7, name: 'Rabiot', role: 'MC', baseX: -26, baseZ: 24 },
  { id: 8, name: 'Antony', role: 'ED', baseX: 36, baseZ: 8 },
  { id: 9, name: 'Capitán', role: 'DC', isCaptain: true, baseX: 0, baseZ: 6 },
  { id: 10, name: 'Gakpo', role: 'EI', baseX: -36, baseZ: 8 },
];

const AWAY_LINEUP_BASE: PlayerRole[] = [
  { id: 0, name: 'Schulz', role: 'POR', isGoalkeeper: true, baseX: 0, baseZ: -80 },
  { id: 1, name: 'Becker', role: 'LI', baseX: 40, baseZ: -58 },
  { id: 2, name: 'Hoffmann', role: 'DFC', baseX: 15, baseZ: -63 },
  { id: 3, name: 'Weber', role: 'DFC', baseX: -15, baseZ: -63 },
  { id: 4, name: 'Wagner', role: 'LD', baseX: -40, baseZ: -58 },
  { id: 5, name: 'Fischer', role: 'MCD', baseX: 0, baseZ: -38 },
  { id: 6, name: 'Kruse', role: 'MC', baseX: 26, baseZ: -24 },
  { id: 7, name: 'Richter', role: 'MC', baseX: -26, baseZ: -24 },
  { id: 8, name: 'Vogel', role: 'ED', baseX: 36, baseZ: -8 },
  { id: 9, name: 'Meyer', role: 'DC', isCaptain: true, baseX: 0, baseZ: -6 },
  { id: 10, name: 'Brandt', role: 'EI', baseX: -36, baseZ: -8 },
];

export default function FootballGame({
  team,
  mode = 'match',
  multiplayerRoomId,
  multiplayerRole = 'host',
  opponentName,
  opponentTeam,
  trainingDrill,
  initialPeriod,
  onShowLoading,
  onExitToMenu,
  onMatchComplete,
  onGoalScored,
  onTrainingReward,
  onSwitchTrainingDrill,
  onOpenTrainingMenu,
}: FootballGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  // Score & Time Management
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [matchPeriod, setMatchPeriod] = useState<MatchPeriod>(initialPeriod || '1st_half');
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes (120s) per half/extra time
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [rivalAbandoned, setRivalAbandoned] = useState(false);

  // Multiplayer Room Listener
  useEffect(() => {
    if (mode !== 'multiplayer' || !multiplayerRoomId) return;

    if (multiplayerRole === 'host') {
      updateMatchRoomState(multiplayerRoomId, {
        status: 'playing',
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Error setting playing status:', err));
    }

    const unsub = listenToMatchRoom(multiplayerRoomId, (data) => {
      if (!data) return;
      if (data.status === 'abandoned' && !gameOver) {
        setRivalAbandoned(true);
        sounds.playWhistle();
      }

      // Sync score from the other player
      if (multiplayerRole === 'host') {
        if (typeof data.scoreAway === 'number' && data.scoreAway > aiScoreRef.current) {
          setAiScore(data.scoreAway);
        }
      } else {
        if (typeof data.scoreHome === 'number' && data.scoreHome > aiScoreRef.current) {
          setAiScore(data.scoreHome);
        }
      }
    });

    return () => {
      unsub();
    };
  }, [mode, multiplayerRoomId, gameOver, multiplayerRole]);

  // Active Training Drill State
  const [currentDrill, setCurrentDrill] = useState<string>(() => {
    if (!trainingDrill) return 'tiro_libre';
    return trainingDrill.replace('drill_', '');
  });
  const [trainingCoinsEarned, setTrainingCoinsEarned] = useState<number>(0);
  const [trainingGoalsCount, setTrainingGoalsCount] = useState<number>(0);
  const [trainingDrillSelectorOpen, setTrainingDrillSelectorOpen] = useState(false);
  const [trainingRewardNotification, setTrainingRewardNotification] = useState<{
    title: string;
    subtitle: string;
    coins: number;
  } | null>(null);

  const currentDrillRef = useRef(currentDrill);
  const onTrainingRewardRef = useRef(onTrainingReward);
  const onSwitchTrainingDrillRef = useRef(onSwitchTrainingDrill);
  const setupTrainingDrillRef = useRef<((drillId?: string) => void) | null>(null);
  const executeTrainingActionRef = useRef<((actionKey: string) => void) | null>(null);

  useEffect(() => {
    onSwitchTrainingDrillRef.current = onSwitchTrainingDrill;
  }, [onSwitchTrainingDrill]);

  // Announcements & Notices
  const [goalAnnouncement, setGoalAnnouncement] = useState<{ scorer: 'player' | 'ai'; text: string } | null>(null);
  const [refereeNotice, setRefereeNotice] = useState<{
    type: 'offside' | 'foul' | 'penalty' | 'throwin' | 'corner' | 'goalkick' | 'period';
    text: string;
  } | null>(null);

  // Active Set-Piece execution state (Pauses game and prompts user to execute)
  const [activeSetPiece, setActiveSetPiece] = useState<{
    type: 'foul' | 'penalty' | 'corner' | 'throwin';
    team: 'home' | 'away';
    title: string;
  } | null>(null);

  // Camera & Walkout Ceremony
  const [cameraMode, setCameraMode] = useState<CameraMode>('tv');
  const [showHelp, setShowHelp] = useState(false);
  const [isWalkout, setIsWalkout] = useState(initialPeriod || mode === 'training' ? false : true);
  const [walkoutStep, setWalkoutStep] = useState<'tunnel' | 'handshake' | 'pause' | 'positions'>('tunnel');
  const walkoutProgressBarRef = useRef<HTMLDivElement>(null);
  const currentWalkoutStepRef = useRef<'tunnel' | 'handshake' | 'pause' | 'positions'>('tunnel');
  const [activePlayerIndex, setActivePlayerIndex] = useState(9); // Default Captain

  // Score & Time Refs for safe access outside React render cycles
  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);
  const timeRemainingRef = useRef(120);

  useEffect(() => {
    currentDrillRef.current = currentDrill;
  }, [currentDrill]);

  useEffect(() => {
    onTrainingRewardRef.current = onTrainingReward;
  }, [onTrainingReward]);

  useEffect(() => {
    if (trainingDrill) {
      const clean = trainingDrill.replace('drill_', '');
      setCurrentDrill(clean);
      currentDrillRef.current = clean;
      if (setupTrainingDrillRef.current) {
        setupTrainingDrillRef.current(clean);
      }
    }
  }, [trainingDrill]);

  useEffect(() => {
    playerScoreRef.current = playerScore;
  }, [playerScore]);

  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);

  // Penalty Shootout Interactive State
  const [penaltyRound, setPenaltyRound] = useState(0);
  const [penaltyTurn, setPenaltyTurn] = useState<'user' | 'rival'>('user');
  const [homePenalties, setHomePenalties] = useState<boolean[]>([]);
  const [awayPenalties, setAwayPenalties] = useState<boolean[]>([]);
  const [penaltyMessage, setPenaltyMessage] = useState<string>('Elige dirección para tirar tu penal');

  // Virtual Input Ref
  const virtualInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Mouse Aim & Charge Power Bar Refs
  const powerBarContainerRef = useRef<HTMLDivElement>(null);
  const powerBarFillRef = useRef<HTMLDivElement>(null);
  const powerBarLabelRef = useRef<HTMLSpanElement>(null);

  // Action Triggers Ref
  const actionTriggersRef = useRef({
    kick: false,
    pass: false,
    tackle: false,
    dribble: false,
    sprint: false,
  });

  // Loop & Sync Refs
  const isPausedRef = useRef(false);
  const gameOverRef = useRef(false);
  const isWalkoutRef = useRef(initialPeriod || mode === 'training' ? false : true);
  const matchPeriodRef = useRef<MatchPeriod>(initialPeriod || '1st_half');
  const cameraModeRef = useRef<CameraMode>('tv');
  const activePlayerIndexRef = useRef(9);
  const goalCooldownRef = useRef(false);
  const setPieceCooldownRef = useRef(false);
  const lastTouchTeamRef = useRef<'home' | 'away'>('home');
  const activeSetPieceRef = useRef<{
    type: 'foul' | 'penalty' | 'corner' | 'throwin';
    team: 'home' | 'away';
    title: string;
  } | null>(null);
  const executeSetPieceHandlerRef = useRef<((actionType?: 'shoot' | 'pass' | 'cross') => void) | null>(null);

  useEffect(() => {
    activeSetPieceRef.current = activeSetPiece;
  }, [activeSetPiece]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    isWalkoutRef.current = isWalkout;
  }, [isWalkout]);

  useEffect(() => {
    matchPeriodRef.current = matchPeriod;
  }, [matchPeriod]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    activePlayerIndexRef.current = activePlayerIndex;
  }, [activePlayerIndex]);

  // Skip walkout cinematic function
  const handleSkipWalkout = () => {
    setIsWalkout(false);
    isWalkoutRef.current = false;
    sounds.playWhistle(true);
    sounds.startStadiumCrowd();
  };

  // Main Three.js Football Simulation
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // --- Colossal Monumental Stadium Field Dimensions: 175m x 110m ---
    const fieldWidth = 110;
    const fieldLength = 175;

    // --- Scene & Renderer Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ec8ed);
    scene.fog = new THREE.FogExp2(0x7ec8ed, 0.0035);

    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- Stadium Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(70, 95, 55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 280;
    sunLight.shadow.camera.left = -90;
    sunLight.shadow.camera.right = 90;
    sunLight.shadow.camera.top = 90;
    sunLight.shadow.camera.bottom = -90;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Dedicated Grandstand & Crowd Illumination (Bathing all spectator stands in bright arena light)
    const standLightN = new THREE.DirectionalLight(0xfffaed, 0.9);
    standLightN.position.set(0, 45, -35);
    standLightN.target.position.set(0, 4, -98);
    scene.add(standLightN.target);
    scene.add(standLightN);

    const standLightS = new THREE.DirectionalLight(0xfffaed, 0.9);
    standLightS.position.set(0, 45, 35);
    standLightS.target.position.set(0, 4, 98);
    scene.add(standLightS.target);
    scene.add(standLightS);

    const standLightE = new THREE.DirectionalLight(0xfffaed, 0.85);
    standLightE.position.set(25, 45, 0);
    standLightE.target.position.set(65, 4, 0);
    scene.add(standLightE.target);
    scene.add(standLightE);

    const standLightW = new THREE.DirectionalLight(0xfffaed, 0.85);
    standLightW.position.set(-25, 45, 0);
    standLightW.target.position.set(-65, 4, 0);
    scene.add(standLightW.target);
    scene.add(standLightW);

    // Corner Floodlight Towers (placed outside 175m x 110m pitch)
    const createFloodlightTower = (x: number, z: number, targetX: number, targetZ: number) => {
      const towerG = new THREE.Group();
      const mastGeom = new THREE.CylinderGeometry(0.45, 0.8, 36, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
      const mast = new THREE.Mesh(mastGeom, mastMat);
      mast.position.y = 18;
      mast.castShadow = true;
      towerG.add(mast);

      const headGeom = new THREE.BoxGeometry(5.2, 3.2, 1.8);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.set(0, 36, 0);
      towerG.add(head);

      const spot = new THREE.SpotLight(0xffffff, 0.95, 170, Math.PI / 4, 0.4);
      spot.position.set(x, 36, z);
      spot.target.position.set(targetX, 0, targetZ);
      scene.add(spot.target);
      scene.add(spot);

      towerG.position.set(x, 0, z);
      scene.add(towerG);
    };

    createFloodlightTower(-fieldWidth / 2 - 14, -fieldLength / 2 - 14, 0, -30);
    createFloodlightTower(fieldWidth / 2 + 14, -fieldLength / 2 - 14, 0, -30);
    createFloodlightTower(-fieldWidth / 2 - 14, fieldLength / 2 + 14, 0, 30);
    createFloodlightTower(fieldWidth / 2 + 14, fieldLength / 2 + 14, 0, 30);

    // --- Grass Pitch (175m x 110m) ---
    const grassTexture = createGrassTexture();
    const pitchGeom = new THREE.PlaneGeometry(fieldWidth, fieldLength);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: grassTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const pitch = new THREE.Mesh(pitchGeom, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    // Surrounding stadium apron
    const apronGeom = new THREE.PlaneGeometry(fieldWidth + 36, fieldLength + 36);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.95 });
    const apron = new THREE.Mesh(apronGeom, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    apron.receiveShadow = true;
    scene.add(apron);

    // --- Pitch Lines & Markings ---
    const markingsGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const createLine = (w: number, h: number, x: number, z: number, rotY: number = 0) => {
      const g = new THREE.PlaneGeometry(w, h);
      const m = new THREE.Mesh(g, lineMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rotY;
      m.position.set(x, 0.02, z);
      markingsGroup.add(m);
    };

    // Boundary lines
    createLine(fieldWidth, 0.28, 0, -fieldLength / 2);
    createLine(fieldWidth, 0.28, 0, fieldLength / 2);
    createLine(fieldLength, 0.28, -fieldWidth / 2, 0, Math.PI / 2);
    createLine(fieldLength, 0.28, fieldWidth / 2, 0, Math.PI / 2);

    // Midfield Line & Center Circle (Radius 11m)
    createLine(fieldWidth, 0.28, 0, 0);

    const centerCircleGeom = new THREE.RingGeometry(11.0, 11.28, 64);
    const centerCircle = new THREE.Mesh(centerCircleGeom, lineMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.set(0, 0.02, 0);
    markingsGroup.add(centerCircle);

    const centerSpotGeom = new THREE.CircleGeometry(0.45, 32);
    const centerSpot = new THREE.Mesh(centerSpotGeom, lineMat);
    centerSpot.rotation.x = -Math.PI / 2;
    centerSpot.position.set(0, 0.02, 0);
    markingsGroup.add(centerSpot);

    // Penalty Areas (24m x 60m) and Goal Areas (8m x 38m)
    const createPenaltyArea = (zCenter: number, isNorth: boolean) => {
      const boxW = 60;
      const boxL = 24;
      const frontZ = isNorth ? zCenter + boxL : zCenter - boxL;

      createLine(boxW, 0.28, 0, frontZ);
      createLine(boxL, 0.28, -boxW / 2, isNorth ? zCenter + boxL / 2 : zCenter - boxL / 2, Math.PI / 2);
      createLine(boxL, 0.28, boxW / 2, isNorth ? zCenter + boxL / 2 : zCenter - boxL / 2, Math.PI / 2);

      const smallW = 38;
      const smallL = 8;
      const smallFrontZ = isNorth ? zCenter + smallL : zCenter - smallL;
      createLine(smallW, 0.28, 0, smallFrontZ);
      createLine(smallL, 0.28, -smallW / 2, isNorth ? zCenter + smallL / 2 : zCenter - smallL / 2, Math.PI / 2);
      createLine(smallL, 0.28, smallW / 2, isNorth ? zCenter + smallL / 2 : zCenter - smallL / 2, Math.PI / 2);

      // Penalty Spot (12m)
      const spotZ = isNorth ? zCenter + 12 : zCenter - 12;
      const pSpot = new THREE.Mesh(centerSpotGeom, lineMat);
      pSpot.rotation.x = -Math.PI / 2;
      pSpot.position.set(0, 0.02, spotZ);
      markingsGroup.add(pSpot);
    };

    createPenaltyArea(-fieldLength / 2, true);
    createPenaltyArea(fieldLength / 2, false);

    // Corner arcs (1.2m radius)
    const cornerArcGeom = new THREE.RingGeometry(1.0, 1.25, 16, 1, 0, Math.PI / 2);
    const addCornerArc = (x: number, z: number, rotZ: number) => {
      const arc = new THREE.Mesh(cornerArcGeom, lineMat);
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = rotZ;
      arc.position.set(x, 0.02, z);
      markingsGroup.add(arc);
    };
    addCornerArc(-fieldWidth / 2, -fieldLength / 2, 0);
    addCornerArc(fieldWidth / 2, -fieldLength / 2, Math.PI / 2);
    addCornerArc(fieldWidth / 2, fieldLength / 2, Math.PI);
    addCornerArc(-fieldWidth / 2, fieldLength / 2, -Math.PI / 2);

    scene.add(markingsGroup);

    // --- Goals / Porterías Monumentales y Más Grandes (32m x 7.8m) ---
    function createGoal(zPos: number, isNorth: boolean) {
      const goalGroup = new THREE.Group();
      const postMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.15,
        metalness: 0.65,
      });

      const goalW = 32.0;
      const goalH = 7.8;

      const postGeom = new THREE.CylinderGeometry(0.32, 0.32, goalH, 16);
      const crossbarGeom = new THREE.CylinderGeometry(0.32, 0.32, goalW, 16);

      const leftPost = new THREE.Mesh(postGeom, postMaterial);
      leftPost.position.set(-goalW / 2, goalH / 2, 0);
      leftPost.castShadow = true;

      const rightPost = new THREE.Mesh(postGeom, postMaterial);
      rightPost.position.set(goalW / 2, goalH / 2, 0);
      rightPost.castShadow = true;

      const crossbar = new THREE.Mesh(crossbarGeom, postMaterial);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, goalH, 0);
      crossbar.castShadow = true;

      goalGroup.add(leftPost, rightPost, crossbar);

      // Net (Back, Top and Sides)
      const netDepth = 6.8;
      const netMat = new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
      });

      const netBackGeom = new THREE.PlaneGeometry(goalW, goalH, 18, 8);
      const netBack = new THREE.Mesh(netBackGeom, netMat);
      netBack.position.set(0, goalH / 2, isNorth ? -netDepth : netDepth);
      if (!isNorth) netBack.rotation.y = Math.PI;

      const netTopGeom = new THREE.PlaneGeometry(goalW, netDepth, 18, 6);
      const netTop = new THREE.Mesh(netTopGeom, netMat);
      netTop.rotation.x = Math.PI / 2;
      netTop.position.set(0, goalH, isNorth ? -netDepth / 2 : netDepth / 2);

      const netSideGeom = new THREE.PlaneGeometry(netDepth, goalH, 6, 8);
      const netLeft = new THREE.Mesh(netSideGeom, netMat);
      netLeft.rotation.y = Math.PI / 2;
      netLeft.position.set(-goalW / 2, goalH / 2, isNorth ? -netDepth / 2 : netDepth / 2);

      const netRight = new THREE.Mesh(netSideGeom, netMat);
      netRight.rotation.y = Math.PI / 2;
      netRight.position.set(goalW / 2, goalH / 2, isNorth ? -netDepth / 2 : netDepth / 2);

      goalGroup.add(netBack, netTop, netLeft, netRight);
      goalGroup.position.z = zPos;
      scene.add(goalGroup);
    }

    createGoal(-fieldLength / 2, true);
    createGoal(fieldLength / 2, false);

    // --- Stadium Grandstands & Perimeter Boards ---
    const stadiumGroup = new THREE.Group();
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

    const createBoard = (w: number, h: number, x: number, z: number, rotY: number = 0) => {
      const g = new THREE.BoxGeometry(w, h, 0.4);
      const b = new THREE.Mesh(g, boardMat);
      b.position.set(x, h / 2, z);
      b.rotation.y = rotY;
      b.castShadow = true;
      stadiumGroup.add(b);
    };

    createBoard((fieldLength - 24) / 2, 1.2, -fieldWidth / 2 - 2, -(fieldLength / 4 + 6), Math.PI / 2);
    createBoard((fieldLength - 24) / 2, 1.2, -fieldWidth / 2 - 2, fieldLength / 4 + 6, Math.PI / 2);
    createBoard(fieldLength + 4, 1.2, fieldWidth / 2 + 2, 0, Math.PI / 2);
    createBoard(32, 1.2, -30, -fieldLength / 2 - 2);
    createBoard(32, 1.2, 30, -fieldLength / 2 - 2);
    createBoard(32, 1.2, -30, fieldLength / 2 + 2);
    createBoard(32, 1.2, 30, fieldLength / 2 + 2);

    // --- AUTHENTIC STEPPED STADIUM BOWL & VIBRANT HUMAN CROWD ---
    const stepConcreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.1 });
    const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
    const canopyRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.4 });
    const blueSeatMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
    const redSeatMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const yellowSeatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const seatColorList = [blueSeatMat, redSeatMat, yellowSeatMat];

    // Helper to add a stepped grandstand tier with seats
    const createBleacherTier = (
      w: number,
      d: number,
      x: number,
      y: number,
      z: number,
      seatMat: THREE.Material,
      rotY: number = 0
    ) => {
      // Concrete riser step
      const stepG = new THREE.BoxGeometry(w, 0.6, d);
      const stepMesh = new THREE.Mesh(stepG, stepConcreteMat);
      stepMesh.position.set(x, y - 0.3, z);
      stepMesh.rotation.y = rotY;
      stepMesh.receiveShadow = true;
      stadiumGroup.add(stepMesh);

      // Stadium seats along the back of the step
      const seatBackG = new THREE.BoxGeometry(w * 0.96, 0.4, 0.1);
      const seatMesh = new THREE.Mesh(seatBackG, seatMat);
      seatMesh.position.set(x, y + 0.2, z);
      seatMesh.rotation.y = rotY;
      stadiumGroup.add(seatMesh);
    };

    // 1. TRIBUNA FONDO NORTE (North Stand - 4 Stepped Tiers + Wall + Scoreboard + Roof)
    for (let r = 0; r < 4; r++) {
      const stepZ = -fieldLength / 2 - 5.5 - r * 2.8;
      const stepY = 0.8 + r * 1.4;
      createBleacherTier(fieldWidth + 24, 2.6, 0, stepY, stepZ, seatColorList[r % seatColorList.length]);
    }
    // North Back Wall & Exterior (behind the highest tier)
    const northWallG = new THREE.BoxGeometry(fieldWidth + 30, 11, 2.5);
    const northWall = new THREE.Mesh(northWallG, backWallMat);
    northWall.position.set(0, 6.0, -fieldLength / 2 - 17.5);
    stadiumGroup.add(northWall);

    // North Roof Canopy (hovering high overhead)
    const northRoofG = new THREE.BoxGeometry(fieldWidth + 36, 1.2, 22);
    const northRoof = new THREE.Mesh(northRoofG, canopyRoofMat);
    northRoof.position.set(0, 17.5, -fieldLength / 2 - 8);
    northRoof.rotation.x = 0.08;
    stadiumGroup.add(northRoof);

    // Giant North Scoreboard
    const jumbotronGeom = new THREE.BoxGeometry(26, 7.0, 1.2);
    const jumbotronScreenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const jumbotronNorth = new THREE.Mesh(jumbotronGeom, jumbotronScreenMat);
    jumbotronNorth.position.set(0, 12.0, -fieldLength / 2 - 16.5);
    stadiumGroup.add(jumbotronNorth);

    // 2. TRIBUNA FONDO SUR (South Stand - 4 Stepped Tiers + Wall + Scoreboard + Roof)
    for (let r = 0; r < 4; r++) {
      const stepZ = fieldLength / 2 + 5.5 + r * 2.8;
      const stepY = 0.8 + r * 1.4;
      createBleacherTier(fieldWidth + 24, 2.6, 0, stepY, stepZ, seatColorList[r % seatColorList.length]);
    }
    const southWallG = new THREE.BoxGeometry(fieldWidth + 30, 11, 2.5);
    const southWall = new THREE.Mesh(southWallG, backWallMat);
    southWall.position.set(0, 6.0, fieldLength / 2 + 17.5);
    stadiumGroup.add(southWall);

    const southRoofG = new THREE.BoxGeometry(fieldWidth + 36, 1.2, 22);
    const southRoof = new THREE.Mesh(southRoofG, canopyRoofMat);
    southRoof.position.set(0, 17.5, fieldLength / 2 + 8);
    southRoof.rotation.x = -0.08;
    stadiumGroup.add(southRoof);

    const jumbotronSouth = new THREE.Mesh(jumbotronGeom, jumbotronScreenMat);
    jumbotronSouth.position.set(0, 12.0, fieldLength / 2 + 16.5);
    stadiumGroup.add(jumbotronSouth);

    // 3. TRIBUNA LATERAL ORIENTE (East Stand - 4 Stepped Tiers + Wall + Roof)
    for (let r = 0; r < 4; r++) {
      const stepX = fieldWidth / 2 + 5.5 + r * 2.8;
      const stepY = 0.8 + r * 1.4;
      createBleacherTier(2.6, fieldLength + 18, stepX, stepY, 0, seatColorList[r % seatColorList.length]);
    }
    const eastWallG = new THREE.BoxGeometry(2.5, 11, fieldLength + 24);
    const eastWall = new THREE.Mesh(eastWallG, backWallMat);
    eastWall.position.set(fieldWidth / 2 + 17.5, 6.0, 0);
    stadiumGroup.add(eastWall);

    const eastRoofG = new THREE.BoxGeometry(22, 1.2, fieldLength + 30);
    const eastRoof = new THREE.Mesh(eastRoofG, canopyRoofMat);
    eastRoof.position.set(fieldWidth / 2 + 8, 17.5, 0);
    eastRoof.rotation.z = -0.08;
    stadiumGroup.add(eastRoof);

    // 4. TRIBUNA LATERAL PONIENTE (West Stand - North wing, South wing, Bridge tier over tunnel)
    const westWingLength = (fieldLength - 36) / 2;
    for (let r = 0; r < 4; r++) {
      const stepX = -fieldWidth / 2 - 5.5 - r * 2.8;
      const stepY = 0.8 + r * 1.4;
      // North wing steps
      createBleacherTier(2.6, westWingLength, stepX, stepY, -fieldLength / 4 - 9, seatColorList[r % seatColorList.length]);
      // South wing steps
      createBleacherTier(2.6, westWingLength, stepX, stepY, fieldLength / 4 + 9, seatColorList[r % seatColorList.length]);
    }
    // Upper VIP Bridge over Tunnel
    createBleacherTier(2.8, 32, -fieldWidth / 2 - 13.5, 6.5, 0, blueSeatMat);

    const westWallG = new THREE.BoxGeometry(2.5, 11, fieldLength + 24);
    const westWall = new THREE.Mesh(westWallG, backWallMat);
    westWall.position.set(-fieldWidth / 2 - 17.5, 6.0, 0);
    stadiumGroup.add(westWall);

    const westRoofG = new THREE.BoxGeometry(22, 1.2, fieldLength + 30);
    const westRoof = new THREE.Mesh(westRoofG, canopyRoofMat);
    westRoof.position.set(-fieldWidth / 2 - 8, 17.5, 0);
    westRoof.rotation.z = 0.08;
    stadiumGroup.add(westRoof);

    // 5. FOUR CORNER GRANDSTANDS (Esquinas escalonadas)
    const cornerSpawns = [
      { x: -fieldWidth / 2 - 10, z: -fieldLength / 2 - 10, rot: Math.PI / 4 },
      { x: fieldWidth / 2 + 10, z: -fieldLength / 2 - 10, rot: -Math.PI / 4 },
      { x: -fieldWidth / 2 - 10, z: fieldLength / 2 + 10, rot: (3 * Math.PI) / 4 },
      { x: fieldWidth / 2 + 10, z: fieldLength / 2 + 10, rot: (-3 * Math.PI) / 4 },
    ];
    cornerSpawns.forEach((corner) => {
      for (let r = 0; r < 3; r++) {
        const dist = 3.5 + r * 2.6;
        const cx = corner.x + Math.sin(corner.rot) * dist;
        const cz = corner.z + Math.cos(corner.rot) * dist;
        const cy = 0.8 + r * 1.4;
        createBleacherTier(18, 2.4, cx, cy, cz, seatColorList[r % seatColorList.length], corner.rot);
      }
    });

    // --- ANIMATED 3D SPECTATORS & DYNAMIC CAMERA FLASHES ---
    interface SpectatorEntity {
      group: THREE.Group;
      leftArm: THREE.Mesh;
      rightArm: THREE.Mesh;
      baseY: number;
      phase: number;
      speed: number;
      isTakingPhoto: boolean;
    }
    const spectators: SpectatorEntity[] = [];

    interface CameraFlashEntity {
      mesh: THREE.Mesh;
      activeTimer: number;
      duration: number;
      nextFlashIn: number;
      baseScale: number;
    }
    const cameraFlashes: CameraFlashEntity[] = [];

    // Detailed Human Spectator Geometries
    const fanLegGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6);
    const fanTorsoGeom = new THREE.CylinderGeometry(0.32, 0.28, 0.72, 8);
    const fanHeadGeom = new THREE.SphereGeometry(0.22, 8, 8);
    const fanCapGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8);
    const fanArmGeom = new THREE.CylinderGeometry(0.075, 0.075, 0.5, 6);
    const scarfGeom = new THREE.BoxGeometry(0.85, 0.14, 0.04);
    const phoneGeom = new THREE.BoxGeometry(0.1, 0.18, 0.03);
    const phoneScreenGeom = new THREE.PlaneGeometry(0.08, 0.14);
    const lensGeom = new THREE.CircleGeometry(0.025, 8);
    const flashGeom = new THREE.SphereGeometry(0.42, 8, 8);

    // Materials
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const phoneBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
    const phoneScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

    const skinTones = [0xfcd34d, 0xe0ac69, 0xc68642, 0x8d5524];
    const skinMats = skinTones.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));

    const fanColors = [0x2563eb, 0xdc2626, 0xfacc15, 0x10b981, 0xffffff, 0x0284c7, 0xf97316, 0x8b5cf6];
    const fanMats = fanColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    const capMats = [0x1e3a8a, 0x991b1b, 0x0f172a, 0xb45309, 0xfacc15].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })
    );

    const scarfMats = [
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }),
    ];

    // Function to assemble an authentic humanoid spectator (persona aficionada)
    const createSpectator = (
      x: number,
      y: number,
      z: number,
      phase: number,
      speed: number,
      isTakingPhoto: boolean,
      facingY: number = 0
    ) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = facingY;

      const jerseyMat = fanMats[Math.floor(Math.random() * fanMats.length)];
      const skinMat = skinMats[Math.floor(Math.random() * skinMats.length)];
      const capMat = capMats[Math.floor(Math.random() * capMats.length)];

      // Two Legs
      const leftLeg = new THREE.Mesh(fanLegGeom, pantsMat);
      leftLeg.position.set(-0.14, 0.28, 0);
      const rightLeg = new THREE.Mesh(fanLegGeom, pantsMat);
      rightLeg.position.set(0.14, 0.28, 0);
      g.add(leftLeg, rightLeg);

      // Torso with colorful team jersey
      const body = new THREE.Mesh(fanTorsoGeom, jerseyMat);
      body.position.y = 0.92;
      g.add(body);

      // Head with skin tone
      const head = new THREE.Mesh(fanHeadGeom, skinMat);
      head.position.y = 1.45;
      g.add(head);

      // Team Cap / Hair
      const cap = new THREE.Mesh(fanCapGeom, capMat);
      cap.position.set(0, 1.58, 0.02);
      g.add(cap);

      // Arms
      const leftArm = new THREE.Mesh(fanArmGeom, jerseyMat);
      const rightArm = new THREE.Mesh(fanArmGeom, jerseyMat);

      if (isTakingPhoto) {
        // Holding smartphone taking photos of the pitch!
        leftArm.position.set(-0.25, 1.15, 0.22);
        leftArm.rotation.x = -1.25;
        leftArm.rotation.z = 0.3;

        rightArm.position.set(0.25, 1.15, 0.22);
        rightArm.rotation.x = -1.35;
        rightArm.rotation.z = -0.22;

        const phone = new THREE.Mesh(phoneGeom, phoneBodyMat);
        phone.position.set(0, 0.24, 0.04);
        phone.rotation.x = 0.2;

        // Glowing screen facing spectator
        const screen = new THREE.Mesh(phoneScreenGeom, phoneScreenMat);
        screen.position.set(0, 0, 0.016);
        screen.rotation.y = Math.PI;
        phone.add(screen);

        // Camera lens facing field
        const lens = new THREE.Mesh(lensGeom, lensMat);
        lens.position.set(0, 0.05, -0.016);
        phone.add(lens);
        rightArm.add(phone);

        // Flash Burst Sprite positioned directly in front of the camera lens
        const flashMesh = new THREE.Mesh(flashGeom, flashMat.clone());
        flashMesh.position.set(x, y + 1.45, z);
        flashMesh.visible = false;
        stadiumGroup.add(flashMesh);

        cameraFlashes.push({
          mesh: flashMesh,
          activeTimer: 0,
          duration: 0.12,
          nextFlashIn: 0.2 + Math.random() * 3.0,
          baseScale: 0.9 + Math.random() * 0.7,
        });
      } else {
        // Cheering fan: arms raised high, pumping fists or waving scarves
        const hasScarf = Math.random() < 0.45;
        if (hasScarf) {
          leftArm.position.set(-0.35, 1.35, 0);
          leftArm.rotation.z = 0.75;
          rightArm.position.set(0.35, 1.35, 0);
          rightArm.rotation.z = -0.75;

          const scarf = new THREE.Mesh(scarfGeom, scarfMats[Math.floor(Math.random() * scarfMats.length)]);
          scarf.position.set(0, 1.85, 0);
          g.add(scarf);
        } else {
          leftArm.position.set(-0.35, 1.25, 0);
          leftArm.rotation.z = 0.6;
          rightArm.position.set(0.35, 1.25, 0);
          rightArm.rotation.z = -0.6;
        }
      }

      g.add(leftArm);
      g.add(rightArm);

      stadiumGroup.add(g);
      spectators.push({ group: g, leftArm, rightArm, baseY: y, phase, speed, isTakingPhoto });
    };

    // 1. POPULATE TRIBUNA FONDO NORTE (North Stand Crowd)
    for (let r = 0; r < 4; r++) {
      const rowZ = -fieldLength / 2 - 5.5 - r * 2.8;
      const rowY = 0.8 + r * 1.4;
      for (let col = -46; col <= 46; col += 2.4) {
        const isPhoto = Math.random() < 0.42;
        createSpectator(col, rowY, rowZ, col * 0.3 + r, 4 + Math.random() * 2.5, isPhoto, 0);
      }
    }

    // 2. POPULATE TRIBUNA FONDO SUR (South Stand Crowd)
    for (let r = 0; r < 4; r++) {
      const rowZ = fieldLength / 2 + 5.5 + r * 2.8;
      const rowY = 0.8 + r * 1.4;
      for (let col = -46; col <= 46; col += 2.4) {
        const isPhoto = Math.random() < 0.42;
        createSpectator(col, rowY, rowZ, col * 0.3 + r, 4 + Math.random() * 2.5, isPhoto, Math.PI);
      }
    }

    // 3. POPULATE TRIBUNA LATERAL ORIENTE (East Stand Crowd)
    for (let r = 0; r < 4; r++) {
      const rowX = fieldWidth / 2 + 5.5 + r * 2.8;
      const rowY = 0.8 + r * 1.4;
      for (let zCol = -74; zCol <= 74; zCol += 2.8) {
        const isPhoto = Math.random() < 0.42;
        createSpectator(rowX, rowY, zCol, zCol * 0.25 + r, 4 + Math.random() * 2.5, isPhoto, -Math.PI / 2);
      }
    }

    // 4. POPULATE TRIBUNA LATERAL PONIENTE (West Stand Crowd)
    for (let r = 0; r < 4; r++) {
      const rowX = -fieldWidth / 2 - 5.5 - r * 2.8;
      const rowY = 0.8 + r * 1.4;
      // North wing
      for (let zCol = -74; zCol <= -16; zCol += 2.8) {
        const isPhoto = Math.random() < 0.42;
        createSpectator(rowX, rowY, zCol, zCol * 0.25 + r, 4 + Math.random() * 2.5, isPhoto, Math.PI / 2);
      }
      // South wing
      for (let zCol = 16; zCol <= 74; zCol += 2.8) {
        const isPhoto = Math.random() < 0.42;
        createSpectator(rowX, rowY, zCol, zCol * 0.25 + r, 4 + Math.random() * 2.5, isPhoto, Math.PI / 2);
      }
    }
    // Upper Bridge Crowd above Tunnel
    for (let zCol = -12; zCol <= 12; zCol += 2.8) {
      const isPhoto = Math.random() < 0.5;
      createSpectator(-fieldWidth / 2 - 13.5, 6.5, zCol, zCol * 0.4, 4.2, isPhoto, Math.PI / 2);
    }

    // 5. POPULATE FOUR CORNER STANDS (Esquinas)
    cornerSpawns.forEach((corner, cIdx) => {
      for (let r = 0; r < 3; r++) {
        const dist = 3.5 + r * 2.6;
        const cy = 0.8 + r * 1.4;
        for (let i = -3; i <= 3; i++) {
          const offset = i * 2.2;
          const perpX = Math.cos(corner.rot) * offset + Math.sin(corner.rot) * dist;
          const perpZ = -Math.sin(corner.rot) * offset + Math.cos(corner.rot) * dist;
          const isPhoto = Math.random() < 0.4;
          createSpectator(
            corner.x + perpX,
            cy,
            corner.z + perpZ,
            cIdx * 3 + i + r,
            4.2,
            isPhoto,
            corner.rot + Math.PI
          );
        }
      }
    });

    scene.add(stadiumGroup);

    // --- LOCKER ROOM TUNNEL ---
    const tunnelGroup = new THREE.Group();
    const tunnelX = -fieldWidth / 2 - 1; // ≈ -39
    const tunnelDepth = 22;
    const tunnelW = 12;
    const tunnelH = 5.8;

    const archMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const archGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      metalness: 0.9,
      roughness: 0.1,
    });

    const tunnelFrameGeom = new THREE.BoxGeometry(tunnelDepth, 0.4, 0.4);
    for (let zOffset of [-tunnelW / 2, tunnelW / 2]) {
      const rail = new THREE.Mesh(tunnelFrameGeom, archMat);
      rail.position.set(tunnelX - tunnelDepth / 2, tunnelH, zOffset);
      tunnelGroup.add(rail);

      const railLow = new THREE.Mesh(tunnelFrameGeom, archMat);
      railLow.position.set(tunnelX - tunnelDepth / 2, 1.2, zOffset);
      tunnelGroup.add(railLow);
    }

    const roofGeom = new THREE.BoxGeometry(tunnelDepth, 0.25, tunnelW);
    const roof = new THREE.Mesh(roofGeom, archGlassMat);
    roof.position.set(tunnelX - tunnelDepth / 2, tunnelH, 0);
    tunnelGroup.add(roof);

    const carpetGeom = new THREE.PlaneGeometry(tunnelDepth + 4, 4);
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
    const carpet = new THREE.Mesh(carpetGeom, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(tunnelX - tunnelDepth / 2 + 2, 0.04, 0);
    tunnelGroup.add(carpet);

    const tunnelLight = new THREE.PointLight(0xffedd5, 1.8, 28);
    tunnelLight.position.set(tunnelX - 11, 3.5, 0);
    tunnelGroup.add(tunnelLight);

    const dugoutGeom = new THREE.BoxGeometry(11, 3.5, 4.5);
    const dugoutMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.85 });
    const homeDugout = new THREE.Mesh(dugoutGeom, dugoutMat);
    homeDugout.position.set(tunnelX - 5, 1.75, 13);
    const awayDugout = new THREE.Mesh(dugoutGeom, dugoutMat);
    awayDugout.position.set(tunnelX - 5, 1.75, -13);
    tunnelGroup.add(homeDugout, awayDugout);

    scene.add(tunnelGroup);

    // --- ARTICULATED PLAYER ENTITY ---
    interface ArticulatedPlayer {
      group: THREE.Group;
      leftLeg: THREE.Group;
      rightLeg: THREE.Group;
      leftArm: THREE.Group;
      rightArm: THREE.Group;
      torso: THREE.Mesh;
      isGoalkeeper: boolean;
      role: string;
      baseX: number;
      baseZ: number;
      walkCycle: number;
      diveAngle: number;
      isDiving?: boolean;
      diveTimer?: number;
      diveDuration?: number;
      diveTargetX?: number;
      diveTargetY?: number;
      diveDir?: number;
      tackleTimer: number;
      dribbleTimer: number; // AI dribble animation
      sprintTimer: number; // AI sprint burst
      isKnockedDown: boolean;
      knockdownTimer: number;
    }

    // --- PROCEDURAL TEXTURES FOR REALISTIC PLAYERS ---
    const jerseyNumberTextureCache = new Map<string, THREE.CanvasTexture>();
    const getJerseyNumberTexture = (num: number | string, color: string = '#ffffff'): THREE.CanvasTexture => {
      const key = `${num}_${color}`;
      if (jerseyNumberTextureCache.has(key)) return jerseyNumberTextureCache.get(key)!;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);
      ctx.font = '900 170px "Impact", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;
      ctx.fillText(String(num), 128, 130);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      jerseyNumberTextureCache.set(key, tex);
      return tex;
    };

    const crestCanvas = document.createElement('canvas');
    crestCanvas.width = 128;
    crestCanvas.height = 128;
    const crestCtx = crestCanvas.getContext('2d')!;
    crestCtx.beginPath();
    crestCtx.moveTo(64, 12);
    crestCtx.lineTo(112, 34);
    crestCtx.lineTo(102, 92);
    crestCtx.lineTo(64, 120);
    crestCtx.lineTo(26, 92);
    crestCtx.lineTo(16, 34);
    crestCtx.closePath();
    crestCtx.fillStyle = '#f59e0b';
    crestCtx.fill();
    crestCtx.lineWidth = 6;
    crestCtx.strokeStyle = '#ffffff';
    crestCtx.stroke();
    crestCtx.fillStyle = '#ffffff';
    crestCtx.font = 'bold 48px sans-serif';
    crestCtx.textAlign = 'center';
    crestCtx.textBaseline = 'middle';
    crestCtx.fillText('★', 64, 66);
    const crestTexture = new THREE.CanvasTexture(crestCanvas);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext('2d')!;
    const shadowGrad = shadowCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
    shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.22)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    shadowCtx.fillStyle = shadowGrad;
    shadowCtx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);

    const gloveCanvas = document.createElement('canvas');
    gloveCanvas.width = 128;
    gloveCanvas.height = 128;
    const gloveCtx = gloveCanvas.getContext('2d')!;
    gloveCtx.fillStyle = '#10b981';
    gloveCtx.fillRect(0, 0, 128, 128);
    gloveCtx.fillStyle = '#065f46';
    for (let y = 14; y < 128; y += 18) {
      gloveCtx.fillRect(8, y, 112, 4);
    }
    const gloveTexture = new THREE.CanvasTexture(gloveCanvas);

    // Natural Skin and Hair Tone Palettes for realistic human variation
    const SKIN_PALETTE = [
      0xf6d7be, // Light peach
      0xe7bc8e, // Mediterranean
      0xd99a64, // Golden Tan
      0xb97d4c, // Bronze
      0x8b532d, // Warm brown
      0x55321a, // Deep espresso
    ];

    const HAIR_PALETTE = [
      0x1c1917, // Jet black
      0x2c1d13, // Dark brown
      0x452a18, // Chestnut
      0x713f12, // Warm brown
      0xc28f38, // Dirty blonde
      0x1e293b, // Deep black
    ];

    // Shared Reusable Geometries
    const chestGeom = new THREE.CylinderGeometry(0.54, 0.46, 0.74, 18);
    const waistGeom = new THREE.CylinderGeometry(0.46, 0.41, 0.52, 18);
    const neckGeom = new THREE.CylinderGeometry(0.18, 0.20, 0.32, 16);
    const collarGeom = new THREE.TorusGeometry(0.22, 0.042, 8, 20);
    const badgeGeom = new THREE.PlaneGeometry(0.18, 0.18);
    const numberPlateGeom = new THREE.PlaneGeometry(0.44, 0.44);
    const shadowDiscGeom = new THREE.PlaneGeometry(1.5, 1.5);

    const headGeom = new THREE.SphereGeometry(0.36, 20, 20);
    const jawGeom = new THREE.BoxGeometry(0.30, 0.20, 0.26);
    const earGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const noseGeom = new THREE.ConeGeometry(0.065, 0.16, 4);
    const eyeWhiteGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeIrisGeom = new THREE.SphereGeometry(0.026, 8, 8);
    const eyebrowGeom = new THREE.BoxGeometry(0.11, 0.035, 0.05);
    const mouthGeom = new THREE.BoxGeometry(0.13, 0.022, 0.035);
    const hairCrownGeom = new THREE.SphereGeometry(0.38, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.50);
    const hairFadeGeom = new THREE.CylinderGeometry(0.38, 0.36, 0.28, 16, 1, true);

    const shortsGeom = new THREE.CylinderGeometry(0.44, 0.48, 0.56, 16);
    const waistbandGeom = new THREE.TorusGeometry(0.43, 0.038, 8, 20);
    const stripeGeom = new THREE.BoxGeometry(0.04, 0.52, 0.06);

    const thighGeom = new THREE.CylinderGeometry(0.19, 0.16, 0.50, 14);
    const kneecapGeom = new THREE.SphereGeometry(0.14, 10, 10);
    const sockGeom = new THREE.CylinderGeometry(0.165, 0.13, 0.54, 14);
    const sockCuffGeom = new THREE.TorusGeometry(0.16, 0.035, 8, 16);
    const bootUpperGeom = new THREE.BoxGeometry(0.20, 0.16, 0.44);
    const bootLacesGeom = new THREE.BoxGeometry(0.09, 0.035, 0.26);
    const bootSoleGeom = new THREE.BoxGeometry(0.21, 0.03, 0.45);
    const cleatStudGeom = new THREE.CylinderGeometry(0.025, 0.02, 0.04, 6);

    const sleeveGeom = new THREE.CylinderGeometry(0.19, 0.17, 0.36, 12);
    const sleeveCuffGeom = new THREE.TorusGeometry(0.18, 0.03, 8, 16);
    const forearmGeom = new THREE.CylinderGeometry(0.145, 0.12, 0.44, 12);
    const wristTapeGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12);
    const palmGeom = new THREE.BoxGeometry(0.13, 0.16, 0.07);
    const thumbGeom = new THREE.BoxGeometry(0.05, 0.08, 0.05);
    const fingerGeom = new THREE.BoxGeometry(0.12, 0.08, 0.06);

    const gkGloveGeom = new THREE.BoxGeometry(0.28, 0.32, 0.14);
    const gkBackhandGeom = new THREE.BoxGeometry(0.29, 0.30, 0.06);

    // Common materials
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeIrisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xb96e62, roughness: 0.8 });
    const bootUpperMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
    const bootSpeedMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.2 }); // Neon Volt speed stripe
    const bootSoleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.3 });
    const wristTapeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.65, depthWrite: false });
    const crestMat = new THREE.MeshBasicMaterial({ map: crestTexture, transparent: true });
    const gkGlovePalmMat = new THREE.MeshStandardMaterial({ map: gloveTexture, roughness: 0.3 });
    const gkGloveBackMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }); // Electric Cyan backhand

    const createArticulatedPlayer = (
      kitColor: string,
      shortsColor: string,
      isGoalkeeper: boolean = false,
      isCaptain: boolean = false,
      baseX: number = 0,
      baseZ: number = 0,
      role: string = 'JUG',
      playerNumber: number = 10,
      playerIndex: number = 0,
      playerName: string = 'Jugador',
      isHomeTeam: boolean = true
    ): ArticulatedPlayer => {
      const pGroup = new THREE.Group();

      // Individualized skin and hair tones for squad diversity
      const skinColorHex = SKIN_PALETTE[playerIndex % SKIN_PALETTE.length];
      const hairColorHex = HAIR_PALETTE[(playerIndex * 2 + 1) % HAIR_PALETTE.length];

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColorHex, roughness: 0.65 });
      const hairMat = new THREE.MeshStandardMaterial({ color: hairColorHex, roughness: 0.85 });

      // Actual kit colors: Goalkeeper gets high-visibility pro keeper jersey
      const actualKitColor = isGoalkeeper ? (isHomeTeam ? 0x10b981 : 0xf97316) : kitColor;
      const jerseyMat = new THREE.MeshStandardMaterial({ color: actualKitColor, roughness: 0.4 });
      const shortsMat = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.5 });
      const sockMat = new THREE.MeshStandardMaterial({ color: isHomeTeam ? kitColor : shortsColor, roughness: 0.5 });

      // 1. Soft Player Contact Shadow beneath feet
      const playerShadow = new THREE.Mesh(shadowDiscGeom, shadowMat);
      playerShadow.rotation.x = -Math.PI / 2;
      playerShadow.position.y = 0.02;
      pGroup.add(playerShadow);

      // 2. Anatomical Torso (V-Taper Muscular Athletic Body)
      const torsoGroup = new THREE.Group();

      // Upper chest
      const chest = new THREE.Mesh(chestGeom, jerseyMat);
      chest.position.y = 1.76;
      chest.castShadow = true;
      torsoGroup.add(chest);

      // Waist & abs
      const waist = new THREE.Mesh(waistGeom, jerseyMat);
      waist.position.y = 1.34;
      waist.castShadow = true;
      torsoGroup.add(waist);

      // Muscular Neck
      const neck = new THREE.Mesh(neckGeom, skinMat);
      neck.position.y = 2.16;
      neck.castShadow = true;
      torsoGroup.add(neck);

      // Pro Collar Ring
      const collar = new THREE.Mesh(collarGeom, whiteMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 2.12;
      torsoGroup.add(collar);

      // Club Crest on left chest
      const chestBadge = new THREE.Mesh(badgeGeom, crestMat);
      chestBadge.position.set(-0.24, 1.86, -0.48);
      chestBadge.rotation.y = Math.PI;
      torsoGroup.add(chestBadge);

      // Squad Number on Back of Jersey
      const numberTexture = getJerseyNumberTexture(playerNumber, '#ffffff');
      const numberMat = new THREE.MeshBasicMaterial({ map: numberTexture, transparent: true });
      const backNumberMesh = new THREE.Mesh(numberPlateGeom, numberMat);
      backNumberMesh.position.set(0, 1.78, 0.48);
      torsoGroup.add(backNumberMesh);

      pGroup.add(torsoGroup);
      const torso = chest; // Reference maintained for external animations

      // 3. Captain's Armband
      if (isCaptain) {
        const armbandGeom = new THREE.CylinderGeometry(0.20, 0.20, 0.16, 16);
        const armbandMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });
        const armband = new THREE.Mesh(armbandGeom, armbandMat);
        armband.position.set(-0.62, 1.95, 0);
        pGroup.add(armband);
      }

      // 4. Athletic Shorts
      const shortsGroup = new THREE.Group();
      const shorts = new THREE.Mesh(shortsGeom, shortsMat);
      shorts.position.y = 1.0;
      shorts.castShadow = true;
      shortsGroup.add(shorts);

      // Waistband
      const waistband = new THREE.Mesh(waistbandGeom, whiteMat);
      waistband.rotation.x = Math.PI / 2;
      waistband.position.y = 1.27;
      shortsGroup.add(waistband);

      // Side stripes
      [-0.45, 0.45].forEach((sx) => {
        const stripe = new THREE.Mesh(stripeGeom, whiteMat);
        stripe.position.set(sx, 1.0, 0);
        shortsGroup.add(stripe);
      });
      pGroup.add(shortsGroup);

      // 5. Realistic Head & 3D Facial Anatomy
      const headGroup = new THREE.Group();
      headGroup.position.y = 2.48;

      // Cranium
      const headMesh = new THREE.Mesh(headGeom, skinMat);
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      // Jaw and Chin
      const jaw = new THREE.Mesh(jawGeom, skinMat);
      jaw.position.set(0, -0.15, 0.08);
      jaw.castShadow = true;
      headGroup.add(jaw);

      // Ears (Left and Right)
      [-0.36, 0.36].forEach((ex) => {
        const ear = new THREE.Mesh(earGeom, skinMat);
        ear.scale.set(0.6, 1.2, 0.8);
        ear.position.set(ex, 0, -0.04);
        headGroup.add(ear);
      });

      // 3D Sculpted Athletic Nose
      const nose = new THREE.Mesh(noseGeom, skinMat);
      nose.rotation.x = -Math.PI / 4;
      nose.position.set(0, -0.01, 0.36);
      headGroup.add(nose);

      // 3D Eyes (Sclera + Pupil/Iris)
      [-0.12, 0.12].forEach((eyeX) => {
        const eyeWhite = new THREE.Mesh(eyeWhiteGeom, whiteMat);
        eyeWhite.position.set(eyeX, 0.07, 0.32);
        headGroup.add(eyeWhite);

        const eyeIris = new THREE.Mesh(eyeIrisGeom, eyeIrisMat);
        eyeIris.position.set(eyeX, 0.07, 0.36);
        headGroup.add(eyeIris);

        const brow = new THREE.Mesh(eyebrowGeom, hairMat);
        brow.position.set(eyeX, 0.13, 0.34);
        headGroup.add(brow);
      });

      // Mouth / Lips
      const mouth = new THREE.Mesh(mouthGeom, lipMat);
      mouth.position.set(0, -0.13, 0.34);
      headGroup.add(mouth);

      // Realistic 3D Textured Hair
      const hairCrown = new THREE.Mesh(hairCrownGeom, hairMat);
      hairCrown.position.set(0, 0.04, 0);
      headGroup.add(hairCrown);

      const hairFade = new THREE.Mesh(hairFadeGeom, hairMat);
      hairFade.position.set(0, 0.10, -0.04);
      headGroup.add(hairFade);

      pGroup.add(headGroup);

      // 6. Realistic Articulated Legs (Thigh + Knee + High Sock + Contoured Cleat)
      const createLeg = (xOffset: number, isLeft: boolean) => {
        const legPivot = new THREE.Group();
        legPivot.position.set(xOffset, 0.88, 0);

        // Upper Thigh
        const thigh = new THREE.Mesh(thighGeom, skinMat);
        thigh.position.y = -0.22;
        thigh.castShadow = true;
        legPivot.add(thigh);

        // Kneecap
        const knee = new THREE.Mesh(kneecapGeom, skinMat);
        knee.position.set(0, -0.45, 0.04);
        legPivot.add(knee);

        // High Pro Soccer Sock with Shin Guard contour
        const sock = new THREE.Mesh(sockGeom, sockMat);
        sock.position.y = -0.72;
        sock.castShadow = true;
        legPivot.add(sock);

        // Sock turnover cuff with accent band
        const sockCuff = new THREE.Mesh(sockCuffGeom, whiteMat);
        sockCuff.rotation.x = Math.PI / 2;
        sockCuff.position.y = -0.48;
        legPivot.add(sockCuff);

        // Pro Football Cleats (Contoured aerodynamically)
        const bootGroup = new THREE.Group();
        bootGroup.position.set(0, -1.02, -0.06);

        // Upper
        const bootUpper = new THREE.Mesh(bootUpperGeom, bootUpperMat);
        bootUpper.castShadow = true;
        bootGroup.add(bootUpper);

        // Laces / Tongue
        const bootLaces = new THREE.Mesh(bootLacesGeom, whiteMat);
        bootLaces.position.set(0, 0.09, 0.02);
        bootGroup.add(bootLaces);

        // Speed Swoosh / Accent Stripe on outer side
        const bootSpeed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.22), bootSpeedMat);
        bootSpeed.position.set(isLeft ? -0.11 : 0.11, 0.02, 0);
        bootGroup.add(bootSpeed);

        // Soleplate
        const bootSole = new THREE.Mesh(bootSoleGeom, bootSoleMat);
        bootSole.position.y = -0.09;
        bootGroup.add(bootSole);

        // Bottom Studs (Tacos de fútbol)
        [
          [-0.06, -0.12, -0.12],
          [0.06, -0.12, -0.12],
          [-0.06, -0.12, 0.12],
          [0.06, -0.12, 0.12],
        ].forEach(([sx, sy, sz]) => {
          const stud = new THREE.Mesh(cleatStudGeom, bootSpeedMat);
          stud.position.set(sx, sy, sz);
          bootGroup.add(stud);
        });

        legPivot.add(bootGroup);
        return legPivot;
      };

      const leftLeg = createLeg(-0.25, true);
      const rightLeg = createLeg(0.25, false);
      pGroup.add(leftLeg, rightLeg);

      // 7. Realistic Articulated Arms (Sleeve + Bare Forearm + Athletic Hand / GK Glove)
      const createArm = (xOffset: number, isLeft: boolean) => {
        const armPivot = new THREE.Group();
        armPivot.position.set(xOffset, 2.05, 0);

        // Jersey Sleeve
        const sleeve = new THREE.Mesh(sleeveGeom, jerseyMat);
        sleeve.position.y = -0.18;
        sleeve.castShadow = true;
        armPivot.add(sleeve);

        // Sleeve cuff ring
        const sleeveCuff = new THREE.Mesh(sleeveCuffGeom, whiteMat);
        sleeveCuff.rotation.x = Math.PI / 2;
        sleeveCuff.position.y = -0.34;
        armPivot.add(sleeveCuff);

        // Muscular Forearm
        const forearm = new THREE.Mesh(forearmGeom, skinMat);
        forearm.position.y = -0.58;
        forearm.castShadow = true;
        armPivot.add(forearm);

        // White Athletic Wrist Tape
        const wristTape = new THREE.Mesh(wristTapeGeom, wristTapeMat);
        wristTape.position.y = -0.78;
        armPivot.add(wristTape);

        if (isGoalkeeper) {
          // Professional Goalkeeper Gloves
          const gkGlove = new THREE.Mesh(gkGloveGeom, gkGlovePalmMat);
          gkGlove.position.set(0, -0.92, 0);
          gkGlove.castShadow = true;
          armPivot.add(gkGlove);

          const gkBackhand = new THREE.Mesh(gkBackhandGeom, gkGloveBackMat);
          gkBackhand.position.set(0, -0.92, 0.08);
          armPivot.add(gkBackhand);
        } else {
          // Anatomical Athletic Hand (Palm + Thumb + Flexed Fingers in running posture)
          const handGroup = new THREE.Group();
          handGroup.position.set(0, -0.88, 0);

          const palm = new THREE.Mesh(palmGeom, skinMat);
          handGroup.add(palm);

          const thumb = new THREE.Mesh(thumbGeom, skinMat);
          thumb.position.set(isLeft ? 0.08 : -0.08, -0.02, 0.04);
          thumb.rotation.z = isLeft ? -Math.PI / 6 : Math.PI / 6;
          handGroup.add(thumb);

          const fingers = new THREE.Mesh(fingerGeom, skinMat);
          fingers.position.set(0, -0.10, 0.02);
          handGroup.add(fingers);

          armPivot.add(handGroup);
        }

        return armPivot;
      };

      const leftArm = createArm(-0.62, true);
      const rightArm = createArm(0.62, false);
      pGroup.add(leftArm, rightArm);

      scene.add(pGroup);

      return {
        group: pGroup,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        torso,
        isGoalkeeper,
        role,
        baseX,
        baseZ,
        walkCycle: Math.random() * Math.PI * 2,
        diveAngle: 0,
        isDiving: false,
        diveTimer: 0,
        diveDuration: 0,
        diveTargetX: 0,
        diveTargetY: 0,
        diveDir: 0,
        tackleTimer: 0,
        dribbleTimer: 0,
        sprintTimer: 0,
        isKnockedDown: false,
        knockdownTimer: 0,
      };
    };

    // --- CREATE 22 PLAYERS (11 HOME + 11 AWAY) WITH DIVERSE SQUAD NUMBERS ---
    const homeKit = team?.jerseyColor || '#2563eb';
    const homeShorts = team?.shortsColor || '#ffffff';
    const awayKit = opponentTeam?.jerseyColor || team?.rivalColor || '#dc2626';
    const awayShorts = opponentTeam?.shortsColor || '#0f172a';

    const homePlayers: ArticulatedPlayer[] = HOME_LINEUP_BASE.map((p, idx) => {
      const num = p.isCaptain ? (team?.playerNumber || 9) : (p.id === 0 ? 1 : p.id === 1 ? 26 : p.id === 2 ? 13 : p.id === 3 ? 2 : p.id === 4 ? 3 : p.id === 5 ? 4 : p.id === 6 ? 20 : p.id === 7 ? 14 : p.id === 8 ? 21 : p.id === 10 ? 18 : 10);
      return createArticulatedPlayer(
        homeKit,
        homeShorts,
        p.isGoalkeeper,
        p.isCaptain,
        p.baseX,
        p.baseZ,
        p.role,
        num,
        idx,
        p.name,
        true
      );
    });

    const awayPlayers: ArticulatedPlayer[] = AWAY_LINEUP_BASE.map((p, idx) => {
      const num = p.isGoalkeeper ? 1 : (idx + 1);
      return createArticulatedPlayer(
        awayKit,
        awayShorts,
        p.isGoalkeeper,
        p.isCaptain,
        p.baseX,
        p.baseZ,
        p.role,
        num,
        idx + 11,
        p.name,
        false
      );
    });

    homePlayers.forEach((p, idx) => {
      p.group.position.set(-54 + idx * 1.4, 0, -1.5);
      p.group.rotation.y = -Math.PI / 2;
    });

    awayPlayers.forEach((p, idx) => {
      p.group.position.set(-54 + idx * 1.4, 0, 1.5);
      p.group.rotation.y = -Math.PI / 2;
    });

    // --- OVERHEAD ACTIVE PLAYER MARKER ---
    const indicatorGroup = new THREE.Group();
    const ringGeom = new THREE.RingGeometry(1.0, 1.25, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const indRing = new THREE.Mesh(ringGeom, ringMat);
    indRing.rotation.x = -Math.PI / 2;
    indRing.position.y = 0.05;
    indicatorGroup.add(indRing);

    const arrowGeom = new THREE.ConeGeometry(0.38, 0.65, 16);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7 });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.rotation.x = Math.PI;
    arrow.position.y = 3.8;
    indicatorGroup.add(arrow);

    scene.add(indicatorGroup);

    // --- SOCCER BALL ---
    const ballTexture = createSoccerBallTexture();
    const ballGeom = new THREE.SphereGeometry(0.58, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.35,
      metalness: 0.05,
    });
    const ball = new THREE.Mesh(ballGeom, ballMat);
    ball.position.set(0, 0.58, 0);
    ball.castShadow = true;
    scene.add(ball);

    const ballVelocity = new THREE.Vector3(0, 0, 0);

    // Possession & Physics Control
    let ballPossession: { team: 'home' | 'away'; index: number } | null = null;
    let ballFreeTimer = 0;

    // --- TRAINING DRILL REWARD & SETUP HELPERS ---
    function triggerTrainingSuccess(reason: string) {
      sounds.playCheer();
      sounds.playGoalCelebration();
      confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
      const reward = 10;
      setTrainingCoinsEarned((c) => c + reward);
      setTrainingGoalsCount((g) => g + 1);
      setTrainingRewardNotification({
        title: '¡Entrenamiento Exitoso!',
        subtitle: reason,
        coins: reward,
      });
      if (onTrainingRewardRef.current) {
        onTrainingRewardRef.current(reward, reason);
      }
    }

    // --- SETUP DRILL ON 3D PITCH ---
    function setupTrainingDrill(drillId: string = currentDrillRef.current) {
      const cleanDrill = drillId.replace('drill_', '');
      ballPossession = null;
      ballFreeTimer = 0.5;
      goalCooldownRef.current = false;
      lastTouchTeamRef.current = 'home';
      sounds.playWhistle(true);

      // Move bench & inactive players to sidelines so active pitch zone is unobstructed
      homePlayers.forEach((p, idx) => {
        p.group.position.set(-36 - (idx % 3) * 3, 0, 10 + idx * 4);
        p.group.rotation.y = -Math.PI / 2;
        p.group.rotation.x = 0;
        p.diveAngle = 0;
        p.tackleTimer = 0;
        p.dribbleTimer = 0;
        p.isKnockedDown = false;
        p.knockdownTimer = 0;
      });

      awayPlayers.forEach((p, idx) => {
        p.group.position.set(36 + (idx % 3) * 3, 0, 10 + idx * 4);
        p.group.rotation.y = Math.PI / 2;
        p.group.rotation.x = 0;
        p.diveAngle = 0;
        p.tackleTimer = 0;
        p.dribbleTimer = 0;
        p.isKnockedDown = false;
        p.knockdownTimer = 0;
      });

      const userKicker = homePlayers[activePlayerIndexRef.current] || homePlayers[9];
      const rivalGK = awayPlayers[0];

      if (rivalGK) {
        rivalGK.group.position.set(0, 0, -fieldLength / 2 + 1.2);
        rivalGK.group.rotation.y = Math.PI;
        rivalGK.diveAngle = 0;
        rivalGK.isDiving = false;
      }

      if (cleanDrill === 'tiro_libre') {
        // FREE KICK (27m from North goal, 4-man defensive wall)
        ball.position.set(0, 0.58, -fieldLength / 2 + 27);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(0, 0, -fieldLength / 2 + 29.5);
          userKicker.group.rotation.y = 0;
        }

        // 4-man defensive wall at 9.15m ahead
        [-2.2, -0.7, 0.7, 2.2].forEach((x, i) => {
          const wDef = awayPlayers[i + 2];
          if (wDef) {
            wDef.group.position.set(x, 0, -fieldLength / 2 + 17.85);
            wDef.group.rotation.y = Math.PI;
          }
        });

        camera.position.set(0, 8.5, -fieldLength / 2 + 42);
        camera.lookAt(0, 2.8, -fieldLength / 2);
      } else if (cleanDrill === 'penaltis') {
        // PENALTY KICK (11m spot)
        ball.position.set(0, 0.58, -fieldLength / 2 + 12);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(0, 0, -fieldLength / 2 + 14.5);
          userKicker.group.rotation.y = 0;
        }

        camera.position.set(0, 6.2, -fieldLength / 2 + 23);
        camera.lookAt(0, 2.4, -fieldLength / 2);
      } else if (cleanDrill === 'pases') {
        // PASSING DRILL (Central diamond formation)
        ball.position.set(0, 0.58, -8);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(0, 0, -6.2);
          userKicker.group.rotation.y = 0;
        }

        const tm1 = homePlayers[6];
        const tm2 = homePlayers[7];
        const tm3 = homePlayers[8];
        if (tm1) {
          tm1.group.position.set(-16, 0, -22);
          tm1.group.lookAt(0, 0, -8);
        }
        if (tm2) {
          tm2.group.position.set(16, 0, -22);
          tm2.group.lookAt(0, 0, -8);
        }
        if (tm3) {
          tm3.group.position.set(0, 0, -36);
          tm3.group.lookAt(0, 0, -8);
        }

        camera.position.set(0, 22, 14);
        camera.lookAt(0, 0, -20);
      } else if (cleanDrill === 'tiros') {
        // SHOOTING DRILL (21m from goal outside the arc)
        ball.position.set(0, 0.58, -fieldLength / 2 + 21);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(0, 0, -fieldLength / 2 + 23.2);
          userKicker.group.rotation.y = 0;
        }

        camera.position.set(0, 8.0, -fieldLength / 2 + 34);
        camera.lookAt(0, 2.6, -fieldLength / 2);
      } else if (cleanDrill === 'regates') {
        // DRIBBLING DRILL (Obstacle course / defenders in line)
        ball.position.set(0, 0.58, -fieldLength / 2 + 42);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(0, 0, -fieldLength / 2 + 44);
          userKicker.group.rotation.y = 0;
        }

        const d1 = awayPlayers[2];
        const d2 = awayPlayers[3];
        const d3 = awayPlayers[4];
        if (d1) {
          d1.group.position.set(-3.5, 0, -fieldLength / 2 + 32);
          d1.group.rotation.y = Math.PI;
        }
        if (d2) {
          d2.group.position.set(3.5, 0, -fieldLength / 2 + 23);
          d2.group.rotation.y = Math.PI;
        }
        if (d3) {
          d3.group.position.set(0, 0, -fieldLength / 2 + 15);
          d3.group.rotation.y = Math.PI;
        }

        camera.position.set(0, 11, -fieldLength / 2 + 55);
        camera.lookAt(0, 2.5, -fieldLength / 2);
      } else if (cleanDrill === 'centros') {
        // CROSSING DRILL (From right wing into box)
        ball.position.set(28, 0.58, -fieldLength / 2 + 24);
        ballVelocity.set(0, 0, 0);

        if (userKicker) {
          userKicker.group.position.set(28, 0, -fieldLength / 2 + 26);
          userKicker.group.rotation.y = -Math.PI / 4;
        }

        const striker = homePlayers[9];
        const winger = homePlayers[10];
        if (striker) {
          striker.group.position.set(0, 0, -fieldLength / 2 + 11);
          striker.group.lookAt(28, 0, -fieldLength / 2 + 24);
        }
        if (winger) {
          winger.group.position.set(-6, 0, -fieldLength / 2 + 13);
          winger.group.lookAt(28, 0, -fieldLength / 2 + 24);
        }

        camera.position.set(32, 9, -fieldLength / 2 + 38);
        camera.lookAt(5, 3, -fieldLength / 2 + 8);
      } else {
        ball.position.set(0, 0.58, 0);
        ballVelocity.set(0, 0, 0);
      }
    }
    setupTrainingDrillRef.current = setupTrainingDrill;

    // --- EXECUTE SPECIALIZED DRILL ACTION ---
    function executeTrainingAction(actionKey: string) {
      if (goalCooldownRef.current) return;
      sounds.playKick();
      lastTouchTeamRef.current = 'home';
      ballPossession = null;
      ballFreeTimer = 0.5;

      const userKicker = homePlayers[activePlayerIndexRef.current] || homePlayers[9];
      if (userKicker) {
        userKicker.rightLeg.rotation.x = -Math.PI / 2.4;
        setTimeout(() => {
          if (userKicker) userKicker.rightLeg.rotation.x = 0;
        }, 260);
      }

      if (actionKey === 'tl_comba') {
        // Curling free kick over the wall to top left angle
        const target = new THREE.Vector3(-4.8, 5.2, -fieldLength / 2 - 1.2);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.28));
      } else if (actionKey === 'tl_potente') {
        // Empeine total to top right post
        const target = new THREE.Vector3(5.2, 4.6, -fieldLength / 2 - 1.2);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.36));
      } else if (actionKey === 'tl_raso') {
        // Low driven free kick under wall
        const target = new THREE.Vector3(-3.2, 0.45, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.22));
      } else if (actionKey === 'pen_izq') {
        // Penalty to bottom left
        const target = new THREE.Vector3(-5.2, 1.4, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.3));
      } else if (actionKey === 'pen_der') {
        // Penalty to top right
        const target = new THREE.Vector3(5.2, 4.6, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.3));
      } else if (actionKey === 'pen_panenka') {
        // Panenka lob over diving keeper
        const target = new THREE.Vector3(0, 3.4, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(0.92));
      } else if (actionKey === 'pen_fuerte') {
        // High-velocity penalty shot
        const target = new THREE.Vector3(1.0, 2.6, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.4));
      } else if (actionKey === 'pase_raso') {
        const tm = homePlayers[6] || homePlayers[7];
        if (tm) {
          sounds.playPass();
          const dir = new THREE.Vector3().subVectors(tm.group.position, ball.position).normalize();
          ballVelocity.copy(dir.multiplyScalar(0.95));
          setTimeout(() => triggerTrainingSuccess('¡Pase al pie completado con éxito!'), 900);
        }
      } else if (actionKey === 'pase_filtrado') {
        const tm = homePlayers[8] || homePlayers[9];
        if (tm) {
          sounds.playPass();
          const targetPos = tm.group.position.clone().add(new THREE.Vector3(0, 0, -8));
          const dir = new THREE.Vector3().subVectors(targetPos, ball.position).normalize();
          ballVelocity.copy(dir.multiplyScalar(1.1));
          setTimeout(() => triggerTrainingSuccess('¡Pase filtrado milimétrico entre líneas!'), 1000);
        }
      } else if (actionKey === 'tiro_bomba') {
        const target = new THREE.Vector3((Math.random() - 0.5) * 8, 4.5, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.38));
      } else if (actionKey === 'tiro_colocado') {
        const target = new THREE.Vector3(-4.5, 4.2, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.24));
      } else if (actionKey === 'tiro_volea') {
        ball.position.y = 1.4;
        const target = new THREE.Vector3(4.5, 3.8, -fieldLength / 2 - 1.0);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.35));
      } else if (actionKey === 'regate_bicicleta') {
        sounds.playDribble();
        if (userKicker) userKicker.group.position.z -= 8;
        ball.position.z -= 8.5;
        setTimeout(() => {
          const target = new THREE.Vector3(-4.2, 3.5, -fieldLength / 2 - 1.0);
          const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
          ballVelocity.copy(dir.multiplyScalar(1.28));
        }, 600);
      } else if (actionKey === 'centro_area') {
        sounds.playKick();
        const target = new THREE.Vector3(0, 4.8, -fieldLength / 2 + 10);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.15));
        setTimeout(() => {
          const striker = homePlayers[9];
          if (striker) {
            striker.group.position.y = 1.2;
            sounds.playKick();
            const gDir = new THREE.Vector3(0, 2.5, -fieldLength / 2 - 1.0).sub(ball.position).normalize();
            ballVelocity.copy(gDir.multiplyScalar(1.2));
            setTimeout(() => { if (striker) striker.group.position.y = 0; }, 500);
          }
        }, 1100);
      }
    }
    executeTrainingActionRef.current = executeTrainingAction;

    // Reset to kickoff
    function resetToKickoff() {
      if (mode === 'training') {
        setupTrainingDrill(currentDrillRef.current);
        return;
      }

      ballPossession = null;
      ballFreeTimer = 0.6;
      ball.position.set(0, 0.58, 0);
      ballVelocity.set(0, 0, 0);

      homePlayers.forEach((p) => {
        p.group.position.set(p.baseX, 0, p.baseZ);
        p.group.rotation.y = 0;
        p.group.rotation.x = 0;
        p.group.rotation.z = 0;
        p.diveAngle = 0;
        p.tackleTimer = 0;
        p.dribbleTimer = 0;
        p.isKnockedDown = false;
        p.knockdownTimer = 0;
      });

      awayPlayers.forEach((p) => {
        p.group.position.set(p.baseX, 0, p.baseZ);
        p.group.rotation.y = Math.PI;
        p.group.rotation.x = 0;
        p.group.rotation.z = 0;
        p.diveAngle = 0;
        p.tackleTimer = 0;
        p.dribbleTimer = 0;
        p.isKnockedDown = false;
        p.knockdownTimer = 0;
      });
    }

    if (mode === 'training') {
      setupTrainingDrill(currentDrillRef.current);
    }

    // --- REFS & SET PIECE CONTROLS ---
    function triggerFoul(isPenalty: boolean, foulPos: THREE.Vector3, beneficiaryTeam: 'home' | 'away' = 'home') {
      if (setPieceCooldownRef.current) return;
      setPieceCooldownRef.current = true;
      ballPossession = null;
      ballFreeTimer = 2.0;

      sounds.playFoulWhistle();
      sounds.playCrowdGasp();

      if (beneficiaryTeam === 'home') {
        // FOUL IN FAVOR OF HOME TEAM (USER)
        if (isPenalty) {
          setRefereeNotice({ type: 'penalty', text: '🚨 ¡PENALTI A FAVOR! Falta cometida sobre tu delantero' });
          setActiveSetPiece({ type: 'penalty', team: 'home', title: '🚨 ¡PENALTI A FAVOR! Pulsa para patear' });
          ball.position.set(0, 0.58, -fieldLength / 2 + 12);
          ballVelocity.set(0, 0, 0);

          const taker = homePlayers[activePlayerIndexRef.current];
          if (taker) {
            taker.group.position.set(0, 0, -fieldLength / 2 + 14.8);
            taker.group.rotation.y = 0;
          }
          awayPlayers[0].group.position.set(0, 0, -fieldLength / 2 + 1.2);
          awayPlayers[0].group.rotation.y = Math.PI;
        } else {
          setRefereeNotice({ type: 'foul', text: '⚠️ ¡TIRO LIBRE A FAVOR! Falta de juego rival' });
          setActiveSetPiece({ type: 'foul', team: 'home', title: '⚠️ ¡TIRO LIBRE A FAVOR! Pulsa para cobrar' });
          ball.position.copy(foulPos);
          ball.position.y = 0.58;
          ballVelocity.set(0, 0, 0);

          const taker = homePlayers[activePlayerIndexRef.current];
          if (taker) {
            taker.group.position.set(foulPos.x, 0, foulPos.z + 2.0);
            taker.group.lookAt(0, 0, -fieldLength / 2);
          }

          // Form rival defensive wall 9.15m ahead
          const wallDefenders = [awayPlayers[2], awayPlayers[3], awayPlayers[4]];
          wallDefenders.forEach((w, idx) => {
            if (w) {
              w.group.position.set(foulPos.x + (idx - 1) * 1.5, 0, foulPos.z - 9.15);
              w.group.rotation.y = Math.PI;
            }
          });
        }
      } else {
        // FOUL AGAINST HOME TEAM (AWAY RIVAL GETS FREE KICK / PENALTY)
        if (isPenalty) {
          setRefereeNotice({ type: 'penalty', text: '🚨 ¡PENALTI EN CONTRA! Falta de tu equipo en el área' });
          setActiveSetPiece({ type: 'penalty', team: 'away', title: '🚨 ¡PENALTI RIVAL! Prepárate para atajar' });
          ball.position.set(0, 0.58, fieldLength / 2 - 12);
          ballVelocity.set(0, 0, 0);

          const rivalTaker = awayPlayers[9] || awayPlayers[8];
          if (rivalTaker) {
            rivalTaker.group.position.set(0, 0, fieldLength / 2 - 14.8);
            rivalTaker.group.rotation.y = Math.PI;
          }
          homePlayers[0].group.position.set(0, 0, fieldLength / 2 - 1.2);
          homePlayers[0].group.rotation.y = 0;

          // AI rival shoots penalty in 2.0s
          setTimeout(() => {
            if (!activeSetPieceRef.current) return;
            sounds.playWhistle(true);
            sounds.playKick();
            const targetX = (Math.random() - 0.5) * 10;
            const dir = new THREE.Vector3(targetX, 2.5, fieldLength / 2).sub(ball.position).normalize();
            ballVelocity.copy(dir.multiplyScalar(1.2));
            ballFreeTimer = 0.5;
            lastTouchTeamRef.current = 'away';
            setActiveSetPiece(null);
            setRefereeNotice(null);
            setPieceCooldownRef.current = false;
          }, 2000);
        } else {
          setRefereeNotice({ type: 'foul', text: '⚠️ ¡FALTA COMETIDA! Tiro libre para el rival' });
          setActiveSetPiece({ type: 'foul', team: 'away', title: '⚠️ ¡TIRO LIBRE RIVAL! El rival cobrará la falta...' });
          ball.position.copy(foulPos);
          ball.position.y = 0.58;
          ballVelocity.set(0, 0, 0);

          // Crucial: Retreat user's active player at least 10m away behind the ball
          const userPlayer = homePlayers[activePlayerIndexRef.current];
          if (userPlayer) {
            userPlayer.group.position.set(foulPos.x, 0, Math.min(fieldLength / 2 - 4, foulPos.z + 10.5));
            userPlayer.group.lookAt(foulPos.x, 0, foulPos.z);
          }

          const rivalTaker = awayPlayers[9] || awayPlayers[6];
          if (rivalTaker) {
            rivalTaker.group.position.set(foulPos.x, 0, foulPos.z - 2.5);
            rivalTaker.group.lookAt(0, 0, fieldLength / 2);
          }

          // Form HOME defensive wall 9.15m ahead facing North (towards ball)
          const wallDefenders = [homePlayers[2], homePlayers[3], homePlayers[4]];
          wallDefenders.forEach((w, idx) => {
            if (w) {
              w.group.position.set(foulPos.x + (idx - 1) * 1.5, 0, Math.min(fieldLength / 2 - 4, foulPos.z + 9.15));
              w.group.lookAt(foulPos.x, 0, foulPos.z);
            }
          });

          // AI rival shoots / passes free kick in 2.2s
          setTimeout(() => {
            if (!activeSetPieceRef.current || activeSetPieceRef.current.team !== 'away') return;
            sounds.playWhistle(true);
            sounds.playKick();
            const target = new THREE.Vector3((Math.random() - 0.5) * 12, 3.8, fieldLength / 2);
            const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
            ballVelocity.copy(dir.multiplyScalar(1.15));
            ballFreeTimer = 0.5;
            lastTouchTeamRef.current = 'away';
            setActiveSetPiece(null);
            setRefereeNotice(null);
            setPieceCooldownRef.current = false;
          }, 2200);
        }
      }
    }

    function triggerOffside(offsidePos: THREE.Vector3) {
      if (setPieceCooldownRef.current) return;
      setPieceCooldownRef.current = true;
      ballPossession = null;
      ballFreeTimer = 1.5;

      sounds.playFoulWhistle();
      setRefereeNotice({ type: 'offside', text: '🚩 ¡FUERA DE JUEGO! (OFFSIDE)' });

      ball.position.copy(offsidePos);
      ball.position.y = 0.58;
      ballVelocity.set(0, 0, 0);

      setTimeout(() => {
        setRefereeNotice(null);
        setPieceCooldownRef.current = false;
      }, 2500);
    }

    // --- SAQUE DE BANDA (THROW-IN) ---
    function triggerThrowIn(sideX: number, zPos: number) {
      if (setPieceCooldownRef.current) return;
      setPieceCooldownRef.current = true;
      ballPossession = null;
      ballFreeTimer = 2.0;

      sounds.playWhistle(true);
      const isHomeThrow = lastTouchTeamRef.current === 'away';
      setRefereeNotice({
        type: 'throwin',
        text: `📣 SAQUE DE BANDA para ${isHomeThrow ? team?.teamName || 'Local' : 'Rival'}`,
      });
      setActiveSetPiece({
        type: 'throwin',
        team: isHomeThrow ? 'home' : 'away',
        title: isHomeThrow ? '📣 ¡SAQUE DE BANDA! Pulsa para jugar' : '📣 Saque de banda rival...',
      });

      ball.position.set(sideX, 0.58, zPos);
      ballVelocity.set(0, 0, 0);

      // Place thrower near sideline
      if (isHomeThrow) {
        const thrower = homePlayers[activePlayerIndexRef.current];
        if (thrower) {
          thrower.group.position.set(sideX + (sideX > 0 ? 1.6 : -1.6), 0, zPos);
          thrower.group.lookAt(sideX > 0 ? sideX - 10 : sideX + 10, 0, zPos);
        }
      } else {
        const thrower = awayPlayers[1];
        if (thrower) {
          thrower.group.position.set(sideX + (sideX > 0 ? 1.6 : -1.6), 0, zPos);
          thrower.group.lookAt(sideX > 0 ? sideX - 10 : sideX + 10, 0, zPos);
        }
        // AI executes throw in 1.8s
        setTimeout(() => {
          if (!activeSetPieceRef.current) return;
          sounds.playPass();
          const target = awayPlayers[6] || awayPlayers[9];
          if (target) {
            const dir = new THREE.Vector3().subVectors(target.group.position, ball.position).normalize();
            ballVelocity.copy(dir.multiplyScalar(0.8));
          }
          ballFreeTimer = 0.5;
          setActiveSetPiece(null);
          setRefereeNotice(null);
          setPieceCooldownRef.current = false;
        }, 1800);
      }
    }

    // --- TIRO DE ESQUINA (CORNER KICK) ---
    function triggerCornerKick(cornerX: number, cornerZ: number, isHomeCorner: boolean) {
      if (setPieceCooldownRef.current) return;
      setPieceCooldownRef.current = true;
      ballPossession = null;
      ballFreeTimer = 2.0;

      sounds.playWhistle(true);
      setRefereeNotice({
        type: 'corner',
        text: `🚩 ¡TIRO DE ESQUINA! (${isHomeCorner ? 'A favor' : 'Rival'})`,
      });
      setActiveSetPiece({
        type: 'corner',
        team: isHomeCorner ? 'home' : 'away',
        title: isHomeCorner ? '🚩 ¡CÓRNER! Pulsa para centrar al área' : '🚩 Córner rival...',
      });

      ball.position.set(cornerX > 0 ? fieldWidth / 2 - 0.6 : -fieldWidth / 2 + 0.6, 0.58, cornerZ);
      ballVelocity.set(0, 0, 0);

      if (isHomeCorner) {
        const cornerTaker = homePlayers[activePlayerIndexRef.current];
        if (cornerTaker) {
          cornerTaker.group.position.set(cornerX, 0, cornerZ);
          cornerTaker.group.lookAt(0, 0, cornerZ + 20);
        }
      } else {
        const cornerTaker = awayPlayers[8];
        if (cornerTaker) {
          cornerTaker.group.position.set(cornerX, 0, cornerZ);
          cornerTaker.group.lookAt(0, 0, cornerZ - 20);
        }
        // AI executes corner in 1.8s
        setTimeout(() => {
          if (!activeSetPieceRef.current) return;
          sounds.playKick();
          const crossTarget = new THREE.Vector3((Math.random() - 0.5) * 14, 4.4, fieldLength / 2 - 20);
          const cDir = new THREE.Vector3().subVectors(crossTarget, ball.position).normalize();
          ballVelocity.copy(cDir.multiplyScalar(1.05));
          ballFreeTimer = 0.6;
          setActiveSetPiece(null);
          setRefereeNotice(null);
          setPieceCooldownRef.current = false;
        }, 1800);
      }
    }

    // --- EXECUTE CURRENT ACTIVE SET PIECE (Called by user buttons / clicks) ---
    function executeCurrentSetPiece(actionType: 'shoot' | 'pass' | 'cross' = 'shoot') {
      const sp = activeSetPieceRef.current;
      if (!sp || sp.team !== 'home') return;

      sounds.playWhistle(true);
      setPieceCooldownRef.current = false;
      activeSetPieceRef.current = null;
      setActiveSetPiece(null);
      setRefereeNotice(null);
      ballPossession = null;
      ballFreeTimer = 0.5;
      lastTouchTeamRef.current = 'home';

      if (sp.type === 'penalty') {
        sounds.playKick();
        const shotTargetX = actionType === 'pass' ? -5.5 : actionType === 'cross' ? 5.5 : (Math.random() - 0.5) * 6;
        const target = new THREE.Vector3(shotTargetX, 2.8, -fieldLength / 2);
        const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.3));
      } else if (sp.type === 'foul') {
        if (actionType === 'shoot') {
          sounds.playKick();
          const target = new THREE.Vector3((Math.random() - 0.5) * 10, 4.0, -fieldLength / 2);
          const dir = new THREE.Vector3().subVectors(target, ball.position).normalize();
          ballVelocity.copy(dir.multiplyScalar(1.2));
        } else {
          sounds.playPass();
          const tm = homePlayers[6] || homePlayers[9];
          const dir = new THREE.Vector3().subVectors(tm.group.position, ball.position).normalize();
          ballVelocity.copy(dir.multiplyScalar(0.95));
        }
      } else if (sp.type === 'corner') {
        sounds.playKick();
        const targetBox = new THREE.Vector3((Math.random() - 0.5) * 16, 4.6, -fieldLength / 2 + 18);
        const dir = new THREE.Vector3().subVectors(targetBox, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(1.1));
      } else if (sp.type === 'throwin') {
        sounds.playPass();
        const tm = homePlayers[7] || homePlayers[6] || homePlayers[9];
        const dir = new THREE.Vector3().subVectors(tm.group.position, ball.position).normalize();
        ballVelocity.copy(dir.multiplyScalar(0.85));
      }
    }
    executeSetPieceHandlerRef.current = executeCurrentSetPiece;

    // --- SAQUE DE META (GOAL KICK) ---
    function triggerGoalKick(isNorth: boolean) {
      if (setPieceCooldownRef.current) return;
      setPieceCooldownRef.current = true;
      ballPossession = null;
      ballFreeTimer = 1.2;

      sounds.playWhistle(true);
      setRefereeNotice({ type: 'goalkick', text: '🧤 SAQUE DE META' });

      const goalZ = isNorth ? -fieldLength / 2 + 6 : fieldLength / 2 - 6;
      ball.position.set(0, 0.58, goalZ);
      ballVelocity.set(0, 0, 0);

      // Goalkeeper prepares kick
      if (isNorth) {
        awayPlayers[0].group.position.set(0, 0, goalZ - 1.5);
        ballPossession = { team: 'away', index: 0 };
      } else {
        homePlayers[0].group.position.set(0, 0, goalZ + 1.5);
        ballPossession = { team: 'home', index: 0 };
      }

      setTimeout(() => {
        setRefereeNotice(null);
        setPieceCooldownRef.current = false;
      }, 3000);
    }

    // Check offside
    function checkOffside(passTarget: THREE.Vector3): boolean {
      if (passTarget.z >= 0) return false;

      let rivalZPositions: number[] = [];
      awayPlayers.forEach((p) => {
        if (!p.isGoalkeeper) rivalZPositions.push(p.group.position.z);
      });

      rivalZPositions.sort((a, b) => a - b);
      const lastDefenderZ = rivalZPositions[0] || -40;

      if (passTarget.z < lastDefenderZ - 0.5) return true;
      return false;
    }

    // Pass Action
    function executePass() {
      const activeP = homePlayers[activePlayerIndexRef.current];
      if (!activeP) return;

      const distToBall = activeP.group.position.distanceTo(ball.position);
      if (distToBall > 3.4) return;

      let bestTeammateIdx = -1;
      let minScore = Infinity;

      homePlayers.forEach((tm, idx) => {
        if (idx === activePlayerIndexRef.current || tm.isGoalkeeper) return;
        const diff = new THREE.Vector3().subVectors(tm.group.position, activeP.group.position);
        const dist = diff.length();

        const forwardAdvantage = diff.z < 0 ? -12 : 6;
        const score = dist + forwardAdvantage;

        if (score < minScore) {
          minScore = score;
          bestTeammateIdx = idx;
        }
      });

      if (bestTeammateIdx !== -1) {
        const target = homePlayers[bestTeammateIdx];

        if (checkOffside(target.group.position)) {
          ballPossession = null;
          triggerOffside(target.group.position);
          return;
        }

        lastTouchTeamRef.current = 'home';
        const passDir = new THREE.Vector3().subVectors(target.group.position, ball.position).normalize();
        passDir.y = 0.06;
        ballVelocity.copy(passDir.multiplyScalar(0.85));

        sounds.playPass();
        ballPossession = null;
        ballFreeTimer = 0.35;
        setActivePlayerIndex(bestTeammateIdx);
        activePlayerIndexRef.current = bestTeammateIdx;
      }
    }

    // --- RAYCASTING & MOUSE AIMING FOR SHOTS & PASSES ---
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundIntersection = new THREE.Vector3();
    const mouseNDC = new THREE.Vector2();

    // 3D Visual Aiming Reticle on the pitch grass
    const aimIndicatorGroup = new THREE.Group();
    aimIndicatorGroup.visible = false;

    const aimRingGeom = new THREE.RingGeometry(1.6, 2.1, 32);
    const aimRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(aimRingGeom, aimRingMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.05;

    const centerDotGeom = new THREE.CircleGeometry(0.5, 24);
    const centerDotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const centerDot = new THREE.Mesh(centerDotGeom, centerDotMat);
    centerDot.rotation.x = -Math.PI / 2;
    centerDot.position.y = 0.06;

    const crossGeom = new THREE.PlaneGeometry(0.22, 4.6);
    const crossMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cross1 = new THREE.Mesh(crossGeom, crossMat);
    cross1.rotation.x = -Math.PI / 2;
    cross1.position.y = 0.05;
    const cross2 = new THREE.Mesh(crossGeom, crossMat);
    cross2.rotation.x = -Math.PI / 2;
    cross2.rotation.z = Math.PI / 2;
    cross2.position.y = 0.05;

    aimIndicatorGroup.add(ringMesh, centerDot, cross1, cross2);
    scene.add(aimIndicatorGroup);

    let chargeAction: {
      active: boolean;
      type: 'shoot' | 'pass';
      startTime: number;
      clientX: number;
      clientY: number;
    } | null = null;

    // Execute charged shot aiming towards 3D target point on pitch or monumental goal
    function executeAimShot(targetPoint: THREE.Vector3, power: number) {
      const activeP = homePlayers[activePlayerIndexRef.current];
      if (!activeP) return;

      const distToBall = activeP.group.position.distanceTo(ball.position);
      const hasPossession =
        ballPossession && ballPossession.team === 'home' && ballPossession.index === activePlayerIndexRef.current;

      if (distToBall > 4.5 && !hasPossession) return;

      ballPossession = null;
      ballFreeTimer = 0.35;
      lastTouchTeamRef.current = 'home';

      const goalW = 32.0;
      let targetX = targetPoint.x;
      let targetZ = targetPoint.z;

      // If clicked towards the rival goal half, aim inside the 32m monumental goalmouth
      if (targetPoint.z < -fieldLength / 2 + 50) {
        targetX = THREE.MathUtils.clamp(targetPoint.x, -goalW / 2 + 1.2, goalW / 2 - 1.2);
        targetZ = -fieldLength / 2;
      }

      // "si es muy fuerte el balón se levanta un poco"
      // If power > 0.5, the ball lifts up majestically into top bins or crossbar!
      let targetY = 0.58;
      let extraLift = 0;
      if (power > 0.5) {
        const liftFactor = (power - 0.5) / 0.5; // 0 to 1
        targetY = 1.2 + liftFactor * 5.8; // reaches up to 7m high (right below the 7.8m crossbar!)
        extraLift = 0.28 + liftFactor * 0.45; // upward arc
      } else {
        targetY = 0.58 + power * 0.9; // low driving shot along turf
      }

      const shotDir = new THREE.Vector3(targetX - ball.position.x, targetY - ball.position.y, targetZ - ball.position.z).normalize();
      const shotSpeed = 1.05 + power * 1.1; // fast, satisfying rocket shot
      ballVelocity.copy(shotDir.multiplyScalar(shotSpeed));
      ballVelocity.y += extraLift;

      sounds.playKick();
      if (power > 0.75) sounds.playCrowdGasp();

      activeP.group.rotation.y = Math.atan2(targetX - activeP.group.position.x, targetZ - activeP.group.position.z) + Math.PI;
    }

    // Execute charged pass aiming towards 3D target point on pitch or teammate
    function executeAimPass(targetPoint: THREE.Vector3, power: number) {
      const activeP = homePlayers[activePlayerIndexRef.current];
      if (!activeP) return;

      const distToBall = activeP.group.position.distanceTo(ball.position);
      const hasPossession =
        ballPossession && ballPossession.team === 'home' && ballPossession.index === activePlayerIndexRef.current;

      if (distToBall > 4.5 && !hasPossession) return;

      // Find nearest teammate to the clicked 3D target point
      let bestTeammateIdx = -1;
      let minTargetDist = Infinity;

      homePlayers.forEach((tm, idx) => {
        if (idx === activePlayerIndexRef.current || tm.isGoalkeeper) return;
        const d = tm.group.position.distanceTo(targetPoint);
        if (d < minTargetDist) {
          minTargetDist = d;
          bestTeammateIdx = idx;
        }
      });

      let passTarget = targetPoint.clone();
      if (bestTeammateIdx !== -1 && minTargetDist < 28) {
        const tm = homePlayers[bestTeammateIdx];
        if (checkOffside(tm.group.position)) {
          ballPossession = null;
          triggerOffside(tm.group.position);
          return;
        }
        passTarget = tm.group.position.clone();
        setActivePlayerIndex(bestTeammateIdx);
        activePlayerIndexRef.current = bestTeammateIdx;
      }

      ballPossession = null;
      ballFreeTimer = 0.35;
      lastTouchTeamRef.current = 'home';

      // Chipped / aerial pass if power > 0.55
      let passLift = 0.05;
      if (power > 0.55) {
        passLift = 0.26 + (power - 0.55) * 0.45; // aerial chip
      }

      const passDir = new THREE.Vector3(passTarget.x - ball.position.x, 0, passTarget.z - ball.position.z).normalize();
      passDir.y = passLift;
      const passSpeed = 0.85 + power * 0.8;
      ballVelocity.copy(passDir.multiplyScalar(passSpeed));

      sounds.playPass();
      activeP.group.rotation.y = Math.atan2(passTarget.x - activeP.group.position.x, passTarget.z - activeP.group.position.z) + Math.PI;
    }

    // Slide Tackle Action (E)
    function executeSlideTackle() {
      const activeP = homePlayers[activePlayerIndexRef.current];
      if (!activeP || activeP.tackleTimer > 0) return;

      activeP.tackleTimer = 0.65;
      sounds.playTackle();

      const distToBall = activeP.group.position.distanceTo(ball.position);

      let nearestRival: ArticulatedPlayer | null = null;
      let minRivalDist = Infinity;
      for (const riv of awayPlayers) {
        if (!riv.isGoalkeeper) {
          const d = activeP.group.position.distanceTo(riv.group.position);
          if (d < minRivalDist) {
            minRivalDist = d;
            nearestRival = riv;
          }
        }
      }

      if (nearestRival && minRivalDist < 3.2) {
        const rivalHadBall =
          ballPossession && ballPossession.team === 'away' && ballPossession.index === awayPlayers.indexOf(nearestRival);
        const distRivalToBall = nearestRival.group.position.distanceTo(ball.position);

        // If rival has possession of ball or user hits rival player before reaching ball -> FOUL BY USER!
        if (rivalHadBall || distToBall > distRivalToBall + 0.4 || distToBall > 2.2) {
          ballPossession = null;
          nearestRival.isKnockedDown = true;
          nearestRival.knockdownTimer = 2.4;

          const inUserBox =
            activeP.group.position.z > fieldLength / 2 - 24 && Math.abs(activeP.group.position.x) < 26;
          // Rival team ('away') is the beneficiary of the foul!
          triggerFoul(inUserBox, nearestRival.group.position.clone(), 'away');
          return;
        }

        // Clean tackle! User cleanly reached ball first
        lastTouchTeamRef.current = 'home';
        nearestRival.isKnockedDown = true;
        nearestRival.knockdownTimer = 1.4;
        ballPossession = { team: 'home', index: activePlayerIndexRef.current };
        ballVelocity.set(0, 0, 0);
        sounds.playKick();
      } else if (distToBall < 2.6) {
        lastTouchTeamRef.current = 'home';
        ballPossession = { team: 'home', index: activePlayerIndexRef.current };
        ballVelocity.set(0, 0, 0);
        sounds.playKick();
      }
    }

    // Dribble Skill Move (Q)
    function executeDribbleSkill() {
      const activeP = homePlayers[activePlayerIndexRef.current];
      if (!activeP) return;

      const distToBall = activeP.group.position.distanceTo(ball.position);
      if (distToBall > 3.2 && (!ballPossession || ballPossession.team !== 'home')) return;

      sounds.playDribble();
      lastTouchTeamRef.current = 'home';

      awayPlayers.forEach((riv) => {
        if (riv.isGoalkeeper) return;
        const dist = activeP.group.position.distanceTo(riv.group.position);
        if (dist < 4.2) {
          riv.isKnockedDown = true;
          riv.knockdownTimer = 2.4;
        }
      });

      ballPossession = { team: 'home', index: activePlayerIndexRef.current };
      const forwardDir = new THREE.Vector3(0, 0.05, -1).normalize();
      activeP.group.position.add(forwardDir.multiplyScalar(1.4));
    }

    // Keyboard & Mouse Listeners
    const keys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;

      if (e.code === 'Space') {
        if (activeSetPieceRef.current) {
          if (activeSetPieceRef.current.team === 'home') {
            executeCurrentSetPiece('shoot');
          }
          return;
        }
        if (!chargeAction) {
          chargeAction = {
            active: true,
            type: 'shoot',
            startTime: performance.now(),
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
          };
          if (powerBarContainerRef.current) {
            powerBarContainerRef.current.style.display = 'flex';
            powerBarContainerRef.current.style.left = `${window.innerWidth / 2}px`;
            powerBarContainerRef.current.style.top = `${window.innerHeight / 2 - 60}px`;
          }
        }
      }
      if (e.code === 'KeyE') executeSlideTackle();
      if (e.code === 'KeyQ') executeDribbleSkill();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') actionTriggersRef.current.sprint = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'Space') {
        if (chargeAction?.active) {
          const elapsed = (performance.now() - chargeAction.startTime) / 1000;
          const power = THREE.MathUtils.clamp(elapsed / 0.85, 0.2, 1.0);
          chargeAction = null;
          if (powerBarContainerRef.current) powerBarContainerRef.current.style.display = 'none';

          // Space shoots towards rival goal center
          executeAimShot(new THREE.Vector3(0, 0, -fieldLength / 2), power);
        }
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') actionTriggersRef.current.sprint = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (activeSetPieceRef.current) {
        if (activeSetPieceRef.current.team === 'home') {
          if (e.button === 0) executeCurrentSetPiece('shoot');
          else if (e.button === 2) {
            e.preventDefault();
            executeCurrentSetPiece('pass');
          }
        }
        return;
      }

      // Check if clicking inside UI elements (ignore if clicking HUD buttons/modals)
      const target = e.target as HTMLElement;
      if (target && target.closest('button, [role="button"], input, select')) return;
      if (isPausedRef.current || gameOverRef.current || isWalkoutRef.current) return;

      mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      const type = e.button === 2 ? 'pass' : 'shoot';
      chargeAction = {
        active: true,
        type,
        startTime: performance.now(),
        clientX: e.clientX,
        clientY: e.clientY,
      };

      if (powerBarContainerRef.current) {
        powerBarContainerRef.current.style.display = 'flex';
        powerBarContainerRef.current.style.left = `${e.clientX}px`;
        powerBarContainerRef.current.style.top = `${e.clientY - 45}px`;
      }
      if (powerBarFillRef.current) {
        powerBarFillRef.current.style.width = '0%';
        powerBarFillRef.current.className = 'h-full rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]';
      }
      if (powerBarLabelRef.current) {
        powerBarLabelRef.current.innerText = type === 'shoot' ? '⚡ POTENCIA TIRO: 0%' : '🎯 POTENCIA PASE: 0%';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (chargeAction?.active && powerBarContainerRef.current) {
        powerBarContainerRef.current.style.left = `${e.clientX}px`;
        powerBarContainerRef.current.style.top = `${e.clientY - 45}px`;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!chargeAction || !chargeAction.active) return;

      const elapsed = (performance.now() - chargeAction.startTime) / 1000;
      const power = THREE.MathUtils.clamp(elapsed / 0.85, 0.2, 1.0);
      const actionType = chargeAction.type;
      chargeAction = null;

      if (powerBarContainerRef.current) {
        powerBarContainerRef.current.style.display = 'none';
      }

      // Raycast to find exact 3D coordinates on pitch ground
      raycaster.setFromCamera(mouseNDC, camera);
      raycaster.ray.intersectPlane(groundPlane, groundIntersection);

      if (actionType === 'shoot') {
        executeAimShot(groundIntersection, power);
      } else {
        executeAimPass(groundIntersection, power);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    // --- GAME LOOP ---
    let animationFrameId: number;
    const timer = new THREE.Timer();
    let walkoutTime = 0;
    let aiPassTimer = 0;
    let aiDribbleTimer = 0;

    let hasWhistledDispersion = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.1);

      if (isPausedRef.current || gameOverRef.current) {
        renderer.render(scene, camera);
        return;
      }

      // --- PHASE 1: CEREMONIAL PRE-MATCH WALKOUT, HANDSHAKES, PAUSE & POSITIONS ---
      if (isWalkoutRef.current) {
        walkoutTime += delta;
        if (walkoutProgressBarRef.current) {
          const pct = Math.min(100, (walkoutTime / 17.5) * 100);
          walkoutProgressBarRef.current.style.width = `${pct}%`;
        }

        if (walkoutTime < 4.5) {
          // 1. SALIDA DE VESTUARIOS: Caminata sincronizada en dos columnas saliendo del túnel
          if (currentWalkoutStepRef.current !== 'tunnel') {
            currentWalkoutStepRef.current = 'tunnel';
            setWalkoutStep('tunnel');
          }
          const walkSpeed = 3.6;

          homePlayers.forEach((p) => {
            p.walkCycle += delta * 7;
            p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.55;
            p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.55;
            p.leftArm.rotation.x = -Math.sin(p.walkCycle) * 0.45;
            p.rightArm.rotation.x = Math.sin(p.walkCycle) * 0.45;
            p.group.position.x += delta * walkSpeed;
            p.group.rotation.y = -Math.PI / 2;
          });

          awayPlayers.forEach((p) => {
            p.walkCycle += delta * 7;
            p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.55;
            p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.55;
            p.leftArm.rotation.x = -Math.sin(p.walkCycle) * 0.45;
            p.rightArm.rotation.x = Math.sin(p.walkCycle) * 0.45;
            p.group.position.x += delta * walkSpeed;
            p.group.rotation.y = -Math.PI / 2;
          });

          camera.position.set(-36, 4.5, 7.5);
          camera.lookAt(-48, 2.0, 0);
        } else if (walkoutTime < 9.0) {
          // 2. SALUDO PROTOCOLARIO: Formación frente a frente y saludo de manos
          if (currentWalkoutStepRef.current !== 'handshake') {
            currentWalkoutStepRef.current = 'handshake';
            setWalkoutStep('handshake');
          }

          homePlayers.forEach((p, idx) => {
            const lineX = -32 + idx * 6.4;
            p.group.position.lerp(new THREE.Vector3(lineX, 0, 2.0), delta * 2.8);
            p.group.rotation.y = 0; // Cara al norte hacia los rivales

            // Saludo de manos: brazo derecho extendido saludando cordialmente
            p.rightArm.rotation.x = -Math.PI / 2.3 + Math.sin(walkoutTime * 5 + idx * 0.3) * 0.22;
            p.leftArm.rotation.x = 0;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
          });

          awayPlayers.forEach((p, idx) => {
            const lineX = -32 + idx * 6.4;
            p.group.position.lerp(new THREE.Vector3(lineX, 0, -2.0), delta * 2.8);
            p.group.rotation.y = Math.PI; // Cara al sur hacia el equipo local

            // Saludo de manos: brazo derecho extendido saludando cordialmente
            p.rightArm.rotation.x = -Math.PI / 2.3 + Math.sin(walkoutTime * 5 + idx * 0.3) * 0.22;
            p.leftArm.rotation.x = 0;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
          });

          // Cámara panorámica de televisión mostrando el saludo y respeto mutuo
          const camX = -14 + (walkoutTime - 4.5) * 5.2;
          camera.position.set(camX, 4.2, 9.5);
          camera.lookAt(camX * 0.3, 1.8, 0);
        } else if (walkoutTime < 12.5) {
          // 3. PAUSA TÁCTICA Y CONCENTRACIÓN: Los equipos se detienen, se concentran y se motivan
          if (currentWalkoutStepRef.current !== 'pause') {
            currentWalkoutStepRef.current = 'pause';
            setWalkoutStep('pause');
          }

          homePlayers.forEach((p, idx) => {
            // Aplausos y concentración antes de ir a sus puestos
            p.rightArm.rotation.x = -Math.PI / 2.4 + Math.sin(walkoutTime * 7 + idx * 0.2) * 0.25;
            p.leftArm.rotation.x = -Math.PI / 2.4 - Math.sin(walkoutTime * 7 + idx * 0.2) * 0.25;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
            p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, idx % 2 === 0 ? 0.3 : -0.3, delta * 2.5);
          });

          awayPlayers.forEach((p, idx) => {
            p.rightArm.rotation.x = -Math.PI / 2.4 + Math.sin(walkoutTime * 7 + idx * 0.2) * 0.25;
            p.leftArm.rotation.x = -Math.PI / 2.4 - Math.sin(walkoutTime * 7 + idx * 0.2) * 0.25;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
            p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, Math.PI + (idx % 2 === 0 ? 0.3 : -0.3), delta * 2.5);
          });

          // Cámara cinematográfica en plano medio
          camera.position.lerp(new THREE.Vector3(0, 11, 24), delta * 2);
          camera.lookAt(0, 2.0, 0);
        } else {
          // 4. DESPLIEGUE A SUS LUGARES TÁCTICOS: Los jugadores corren a ocupar sus posiciones
          if (currentWalkoutStepRef.current !== 'positions') {
            currentWalkoutStepRef.current = 'positions';
            setWalkoutStep('positions');
          }
          if (!hasWhistledDispersion) {
            hasWhistledDispersion = true;
            sounds.playWhistle(false);
          }

          homePlayers.forEach((p) => {
            p.walkCycle += delta * 9;
            p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.55;
            p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.55;
            p.leftArm.rotation.x = -Math.sin(p.walkCycle) * 0.45;
            p.rightArm.rotation.x = Math.sin(p.walkCycle) * 0.45;

            const targetPos = new THREE.Vector3(p.baseX, 0, p.baseZ);
            p.group.position.lerp(targetPos, delta * 2.3);
            p.group.lookAt(p.baseX, 0, p.baseZ - 6);
          });

          awayPlayers.forEach((p) => {
            p.walkCycle += delta * 9;
            p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.55;
            p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.55;
            p.leftArm.rotation.x = -Math.sin(p.walkCycle) * 0.45;
            p.rightArm.rotation.x = Math.sin(p.walkCycle) * 0.45;

            const targetPos = new THREE.Vector3(p.baseX, 0, p.baseZ);
            p.group.position.lerp(targetPos, delta * 2.3);
            p.group.lookAt(p.baseX, 0, p.baseZ + 6);
          });

          // Cámara asciende majestuosamente a la toma general de transmisión
          camera.position.lerp(new THREE.Vector3(0, 52, 78), delta * 1.8);
          camera.lookAt(0, 1, 0);
        }

        if (walkoutTime >= 17.5) {
          handleSkipWalkout();
        }

        renderer.render(scene, camera);
        return;
      }

      // --- PHASE 2: MATCH PLAYING OR SET-PIECE PAUSE ---
      // Check if set-piece execution is active (Falta, Penalti, Córner, Saque de Banda)
      if (activeSetPieceRef.current !== null) {
        ballVelocity.set(0, 0, 0);

        // Keep ball at current set-piece position and animate excited fans and camera flashes
        const time = timer.getElapsed();
        spectators.forEach((fan) => {
          fan.group.position.y = fan.baseY + Math.abs(Math.sin(time * fan.speed + fan.phase)) * 1.1;
          if (fan.isTakingPhoto) {
            fan.rightArm.rotation.x = -1.25 + Math.sin(time * 5 + fan.phase) * 0.12;
            fan.leftArm.rotation.x = -1.15 + Math.cos(time * 5 + fan.phase) * 0.12;
          } else {
            fan.leftArm.rotation.z = Math.sin(time * 8 + fan.phase) * 0.9;
            fan.rightArm.rotation.z = -Math.sin(time * 8 + fan.phase) * 0.9;
          }
          fan.group.lookAt(ball.position.x, fan.group.position.y, ball.position.z);
        });

        cameraFlashes.forEach((flash) => {
          if (flash.activeTimer > 0) {
            flash.activeTimer -= delta;
            const intensity = Math.sin((flash.activeTimer / flash.duration) * Math.PI);
            flash.mesh.scale.setScalar(flash.baseScale * (1 + intensity * 2.0));
            (flash.mesh.material as THREE.MeshBasicMaterial).opacity = intensity;
            flash.mesh.visible = true;
          } else {
            flash.mesh.visible = false;
            flash.nextFlashIn -= delta;
            if (flash.nextFlashIn <= 0) {
              flash.activeTimer = flash.duration;
              flash.nextFlashIn = 0.3 + Math.random() * 1.5;
            }
          }
        });

        // Camera smoothly frames set piece spot
        if (cameraModeRef.current === 'tv') {
          const tvX = 58;
          const tvY = 28;
          camera.position.lerp(new THREE.Vector3(tvX, tvY, ball.position.z * 0.6), delta * 3);
          camera.lookAt(ball.position.x * 0.5, 1.4, ball.position.z);
        }

        renderer.render(scene, camera);
        return;
      }

      // REAL-TIME CHARGE POWER BAR & 3D AIM INDICATOR
      if (chargeAction?.active) {
        const elapsed = (performance.now() - chargeAction.startTime) / 1000;
        const power = THREE.MathUtils.clamp(elapsed / 0.85, 0.15, 1.0);
        const powerPct = Math.round(power * 100);

        if (powerBarFillRef.current) {
          powerBarFillRef.current.style.width = `${powerPct}%`;
          if (powerPct < 45) {
            powerBarFillRef.current.className =
              'h-full rounded-full transition-none bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]';
          } else if (powerPct < 75) {
            powerBarFillRef.current.className =
              'h-full rounded-full transition-none bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]';
          } else {
            powerBarFillRef.current.className =
              'h-full rounded-full transition-none bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,1.0)] animate-pulse';
          }
        }

        if (powerBarLabelRef.current) {
          if (chargeAction.type === 'shoot') {
            powerBarLabelRef.current.innerText =
              powerPct > 70 ? `🔥 TIRO POTENTE ALTO: ${powerPct}%` : `⚡ POTENCIA TIRO: ${powerPct}%`;
          } else {
            powerBarLabelRef.current.innerText =
              powerPct > 70 ? `🚀 PASE BOMBEADO: ${powerPct}%` : `🎯 POTENCIA PASE: ${powerPct}%`;
          }
        }

        // Raycast to place 3D Aim Reticle on the turf
        raycaster.setFromCamera(mouseNDC, camera);
        raycaster.ray.intersectPlane(groundPlane, groundIntersection);
        aimIndicatorGroup.position.set(groundIntersection.x, 0.05, groundIntersection.z);
        aimIndicatorGroup.visible = true;

        const pulseScale = 1.0 + Math.sin(timer.getElapsed() * 10) * 0.12;
        aimIndicatorGroup.scale.set(pulseScale, 1, pulseScale);

        if (chargeAction.type === 'shoot') {
          aimRingMat.color.setHex(powerPct > 70 ? 0xf43f5e : powerPct > 45 ? 0xfbbf24 : 0x10b981);
        } else {
          aimRingMat.color.setHex(0x38bdf8);
        }
      } else {
        aimIndicatorGroup.visible = false;
      }

      // Live match auto-switch with anti-flutter hysteresis
      let closestHomeDist = Infinity;
      let closestHomeIdx = activePlayerIndexRef.current;
      homePlayers.forEach((p, idx) => {
        if (p.isGoalkeeper) return;
        const d = p.group.position.distanceTo(ball.position);
        if (d < closestHomeDist) {
          closestHomeDist = d;
          closestHomeIdx = idx;
        }
      });

      const currentActiveDist =
        homePlayers[activePlayerIndexRef.current]?.group.position.distanceTo(ball.position) ?? Infinity;

      if (
        closestHomeIdx !== activePlayerIndexRef.current &&
        (ballPossession?.team === 'home' || closestHomeDist < currentActiveDist - 3.8)
      ) {
        setActivePlayerIndex(closestHomeIdx);
        activePlayerIndexRef.current = closestHomeIdx;
      }

      // 1. ACTIVE PLAYER MOVEMENT (User Keys: D: delante, A: atrás, W: izquierda, S: derecha)
      const activeP = homePlayers[activePlayerIndexRef.current];
      const isSprinting = actionTriggersRef.current.sprint || keys['ShiftLeft'] || keys['ShiftRight'];
      const playerSpeed = isSprinting ? 0.48 : 0.31;

      if (activeP.tackleTimer > 0) {
        activeP.tackleTimer -= delta;
        activeP.group.position.z -= delta * 10;
        activeP.torso.rotation.x = Math.PI / 2.5;
        activeP.leftLeg.rotation.x = Math.PI / 3;
      } else {
        activeP.torso.rotation.x = 0;
      }

      const moveVec = new THREE.Vector3(0, 0, 0);
      if (keys['KeyD'] || keys['ArrowUp']) moveVec.z -= 1;
      if (keys['KeyA'] || keys['ArrowDown']) moveVec.z += 1;
      if (keys['KeyW'] || keys['ArrowLeft']) moveVec.x -= 1;
      if (keys['KeyS'] || keys['ArrowRight']) moveVec.x += 1;

      if (virtualInputRef.current.x !== 0 || virtualInputRef.current.z !== 0) {
        moveVec.x += virtualInputRef.current.x;
        moveVec.z += virtualInputRef.current.z;
      }

      if (moveVec.lengthSq() > 0 && activeP.tackleTimer <= 0) {
        moveVec.normalize().multiplyScalar(playerSpeed);
        activeP.group.position.add(moveVec);
        activeP.group.rotation.y = Math.atan2(moveVec.x, moveVec.z) + Math.PI;

        activeP.walkCycle += delta * (isSprinting ? 16 : 9);
        activeP.leftLeg.rotation.x = Math.sin(activeP.walkCycle) * 0.65;
        activeP.rightLeg.rotation.x = -Math.sin(activeP.walkCycle) * 0.65;
        activeP.leftArm.rotation.x = -Math.sin(activeP.walkCycle) * 0.5;
        activeP.rightArm.rotation.x = Math.sin(activeP.walkCycle) * 0.5;
      } else if (activeP.tackleTimer <= 0) {
        activeP.leftLeg.rotation.x *= 0.8;
        activeP.rightLeg.rotation.x *= 0.8;
        activeP.leftArm.rotation.x *= 0.8;
        activeP.rightArm.rotation.x *= 0.8;
      }

      activeP.group.position.x = Math.max(-fieldWidth / 2 + 1, Math.min(fieldWidth / 2 - 1, activeP.group.position.x));
      activeP.group.position.z = Math.max(-fieldLength / 2 + 1, Math.min(fieldLength / 2 - 1, activeP.group.position.z));

      // Player Shoot (Click Izq / Space)
      if (actionTriggersRef.current.kick) {
        const distToBall = activeP.group.position.distanceTo(ball.position);
        const hasPossession =
          ballPossession && ballPossession.team === 'home' && ballPossession.index === activePlayerIndexRef.current;

        if (distToBall < 3.5 || hasPossession) {
          ballPossession = null;
          ballFreeTimer = 0.35;
          lastTouchTeamRef.current = 'home';
          const targetZ = -fieldLength / 2;
          const shotTargetX = (Math.random() - 0.5) * 14;
          const shotDir = new THREE.Vector3(shotTargetX - ball.position.x, 3.4, targetZ - ball.position.z).normalize();
          ballVelocity.copy(shotDir.multiplyScalar(1.2));
          sounds.playKick();
          actionTriggersRef.current.kick = false;
        }
      }

      // --- BALL POSSESSION & FOLLOWING LOGIC ---
      if (ballFreeTimer > 0) {
        ballFreeTimer -= delta;
      } else if (ballPossession !== null) {
        const carrier =
          ballPossession.team === 'home'
            ? homePlayers[ballPossession.index]
            : awayPlayers[ballPossession.index];

        if (!carrier || carrier.isKnockedDown) {
          ballPossession = null;
        } else {
          // Robust forward calculation for any player heading (in front of feet)
          const carrierAngle = carrier.group.rotation.y;
          const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), carrierAngle);
          const distOffset = 1.35;
          const targetX = carrier.group.position.x + fwd.x * distOffset;
          const targetZ = carrier.group.position.z + fwd.z * distOffset;

          ball.position.x = THREE.MathUtils.lerp(ball.position.x, targetX, delta * 25);
          ball.position.z = THREE.MathUtils.lerp(ball.position.z, targetZ, delta * 25);
          ball.position.y = 0.58;

          ballVelocity.set(0, 0, 0);
          ball.rotation.x += delta * 12;

          if (ballPossession.team === 'home' && activePlayerIndexRef.current !== ballPossession.index) {
            setActivePlayerIndex(ballPossession.index);
            activePlayerIndexRef.current = ballPossession.index;
          }
        }
      } else {
        // Free ball capture
        if (
          activeP &&
          activeP.group.position.distanceTo(ball.position) < 2.4 &&
          ball.position.y < 2.2 &&
          activeP.tackleTimer <= 0
        ) {
          ballPossession = { team: 'home', index: activePlayerIndexRef.current };
          lastTouchTeamRef.current = 'home';
        } else {
          for (let i = 0; i < homePlayers.length; i++) {
            const p = homePlayers[i];
            if (!p.isGoalkeeper && p.group.position.distanceTo(ball.position) < 2.2 && ball.position.y < 2.2) {
              ballPossession = { team: 'home', index: i };
              lastTouchTeamRef.current = 'home';
              setActivePlayerIndex(i);
              activePlayerIndexRef.current = i;
              break;
            }
          }
          if (!ballPossession) {
            for (let i = 0; i < awayPlayers.length; i++) {
              const p = awayPlayers[i];
              if (!p.isGoalkeeper && !p.isKnockedDown && p.group.position.distanceTo(ball.position) < 2.2 && ball.position.y < 2.2) {
                ballPossession = { team: 'away', index: i };
                lastTouchTeamRef.current = 'away';
                break;
              }
            }
          }
        }
      }

      // 2. TEAMMATE AI: SUBIDA EN BLOQUE Y ACOMPAÑAMIENTO TOTAL AL DELANTERO
      // Cuando el delantero sube a la portería rival, su equipo sube en bloque coordinado a apoyarle
      const ballZ = ball.position.z;
      const ballX = ball.position.x;
      const isAttacking = ballZ < 25;

      homePlayers.forEach((p, idx) => {
        if (idx === activePlayerIndexRef.current || p.isGoalkeeper) return;

        let targetX = p.baseX;
        let targetZ = p.baseZ;

        if (isAttacking) {
          // El equipo sube en bloque dinámico hacia el campo rival:
          if (p.role === 'ED') {
            // Extremo Derecho: se abre a la banda derecha en campo rival y sube a línea de fondo para centrar
            targetZ = Math.min(-10, Math.max(-fieldLength / 2 + 10, ballZ + 4));
            targetX = Math.max(24, Math.min(fieldWidth / 2 - 8, ballX + 18));
          } else if (p.role === 'EI') {
            // Extremo Izquierdo: se abre a la banda izquierda en campo rival y acompaña al delantero
            targetZ = Math.min(-10, Math.max(-fieldLength / 2 + 10, ballZ + 4));
            targetX = Math.min(-24, Math.max(-fieldWidth / 2 + 8, ballX - 18));
          } else if (p.role === 'DC') {
            // Delantero Centro (si el usuario controla a otro jugador): se posiciona en el punto de penalti
            targetZ = Math.min(-15, Math.max(-fieldLength / 2 + 12, ballZ - 2));
            targetX = THREE.MathUtils.clamp(ballX * 0.5, -12, 12);
          } else if (p.role === 'MC') {
            // Centrocampistas ofensivos: suben hasta la media luna del área rival para recibir pases y rematar rechaces
            targetZ = Math.min(2, Math.max(-fieldLength / 2 + 20, ballZ + 15));
            targetX = p.baseX * 0.6 + ballX * 0.45;
          } else if (p.role === 'MCD') {
            // Pivote Defensivo: sube a tres cuartos de campo para apoyar y cortar contraataques
            targetZ = Math.min(15, Math.max(-fieldLength / 2 + 32, ballZ + 25));
            targetX = ballX * 0.35;
          } else if (p.role === 'LD' || p.role === 'LI') {
            // Laterales: suben por las bandas cruzando el medio campo hasta campo rival
            targetZ = Math.min(18, Math.max(-fieldLength / 2 + 30, ballZ + 28));
            targetX = p.baseX > 0 ? fieldWidth / 2 - 12 : -fieldWidth / 2 + 12;
          } else if (p.role === 'DFC') {
            // Defensas Centrales: línea defensiva adelantada hasta el medio campo para mantener el equipo compacto
            targetZ = Math.min(38, Math.max(2, ballZ + 42));
            targetX = p.baseX;
          }
        } else {
          // En repliegue o defensa: mantienen sus posiciones tácticas base acompañando la posición del balón
          targetX = p.baseX + ballX * 0.25;
          targetZ = p.baseZ + Math.max(-10, Math.min(15, ballZ * 0.3));
        }

        const currentPos = p.group.position;
        const dir = new THREE.Vector3(targetX - currentPos.x, 0, targetZ - currentPos.z);
        const distToTarget = dir.length();
        if (distToTarget > 1.2) {
          // Velocidad rápida para subir a acompañar al delantero sin quedarse atrás
          const supportSpeed = distToTarget > 22 ? 0.44 : distToTarget > 10 ? 0.35 : 0.26;
          dir.normalize().multiplyScalar(supportSpeed);
          p.group.position.add(dir);
          p.group.rotation.y = Math.atan2(dir.x, dir.z);

          p.walkCycle += delta * (supportSpeed > 0.3 ? 14 : 8);
          p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.55;
          p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.55;
          p.leftArm.rotation.x = -Math.sin(p.walkCycle) * 0.45;
          p.rightArm.rotation.x = Math.sin(p.walkCycle) * 0.45;
        } else {
          // Mirar hacia la portería rival cuando ya están posicionados en ataque
          p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, 0, delta * 3);
          p.leftLeg.rotation.x *= 0.8;
          p.rightLeg.rotation.x *= 0.8;
        }
      });

      // 3. HOME GOALKEEPER (Defiende la portería Sur en z = fieldLength / 2)
      const homeGK = homePlayers[0];
      const goalW = 32.0;
      const goalH = 7.8;

      if (!homeGK.isDiving) {
        const targetGkX = THREE.MathUtils.clamp(ball.position.x * 0.78, -goalW / 2 + 2.5, goalW / 2 - 2.5);
        homeGK.group.position.x = THREE.MathUtils.lerp(homeGK.group.position.x, targetGkX, delta * 4.0);
        homeGK.group.position.y = THREE.MathUtils.lerp(homeGK.group.position.y, 0, delta * 6);
        homeGK.group.position.z = fieldLength / 2 - 2.5;
        homeGK.group.rotation.y = 0;
        homeGK.group.rotation.z = THREE.MathUtils.lerp(homeGK.group.rotation.z, 0, delta * 6);
        homeGK.leftArm.rotation.z = THREE.MathUtils.lerp(homeGK.leftArm.rotation.z, 0, delta * 6);
        homeGK.rightArm.rotation.z = THREE.MathUtils.lerp(homeGK.rightArm.rotation.z, 0, delta * 6);
        homeGK.leftLeg.rotation.z = THREE.MathUtils.lerp(homeGK.leftLeg.rotation.z, 0, delta * 6);
        homeGK.rightLeg.rotation.z = THREE.MathUtils.lerp(homeGK.rightLeg.rotation.z, 0, delta * 6);

        // Detect incoming rival shot towards south goal and trigger dive!
        if (ball.position.z > fieldLength / 2 - 42 && ballVelocity.z > 0.28) {
          const tToGoal = (fieldLength / 2 - ball.position.z) / ballVelocity.z;
          const predictedX = ball.position.x + ballVelocity.x * tToGoal;
          const predictedY = Math.max(0.5, ball.position.y + ballVelocity.y * tToGoal);

          const isIncomingOnTarget = Math.abs(predictedX) < goalW / 2 + 1.2 && predictedY < goalH + 0.8;
          if (isIncomingOnTarget) {
            homeGK.isDiving = true;
            homeGK.diveTimer = Math.min(1.0, Math.max(0.65, tToGoal + 0.1));
            homeGK.diveDuration = homeGK.diveTimer;
            homeGK.diveTargetX = THREE.MathUtils.clamp(predictedX, -goalW / 2 + 1.5, goalW / 2 - 1.5);
            homeGK.diveTargetY = THREE.MathUtils.clamp(predictedY, 0.8, goalH - 0.8);
            homeGK.diveDir = Math.sign(predictedX - homeGK.group.position.x) || (Math.random() > 0.5 ? 1 : -1);
          }
        }
      } else {
        // Goalkeeper is diving through the air to block shot!
        homeGK.diveTimer = (homeGK.diveTimer || 0) - delta;
        const duration = homeGK.diveDuration || 0.9;
        const progress = Math.max(0, Math.min(1, 1 - (homeGK.diveTimer || 0) / duration));

        // Horizontal leap across goalmouth
        homeGK.group.position.x += ((homeGK.diveTargetX || 0) - homeGK.group.position.x) * delta * 7.5;
        // Parabolic vertical jump
        const jumpH = Math.sin(progress * Math.PI) * Math.min(4.0, (homeGK.diveTargetY || 1.5) * 0.9);
        homeGK.group.position.y = jumpH;
        // Horizontal mid-air tilt
        homeGK.group.rotation.z = -(homeGK.diveDir || 1) * 1.35 * Math.sin(progress * Math.PI);
        // Arms stretched out towards ball
        homeGK.leftArm.rotation.z = (homeGK.diveDir || 1) > 0 ? 1.85 : -1.85;
        homeGK.rightArm.rotation.z = (homeGK.diveDir || 1) > 0 ? 1.85 : -1.85;

        // Block shot check ("obviamente no todos")
        const gkDist = homeGK.group.position.distanceTo(ball.position);
        if (gkDist < 4.0 && (homeGK.diveTimer || 0) > 0.08 && ballVelocity.z > 0) {
          const isExtremeAngle = Math.abs(ball.position.x) > goalW / 2 - 2.5;
          const isHighScreamer = ball.position.y > goalH - 2.0;
          const saveChance = isExtremeAngle || isHighScreamer ? 0.35 : 0.72;

          if (Math.random() < saveChance) {
            ballPossession = null;
            ballFreeTimer = 0.6;
            sounds.playSave();
            sounds.playCheer();
            lastTouchTeamRef.current = 'home';
            ballVelocity.z = -0.75 - Math.random() * 0.3;
            ballVelocity.x = (homeGK.diveDir || 1) * (0.6 + Math.random() * 0.5);
            ballVelocity.y = 0.25 + Math.random() * 0.3;
            setRefereeNotice({ type: 'foul', text: '🧤 ¡PARADÓN DE TU PORTERO!' });
            setTimeout(() => setRefereeNotice(null), 2000);
          }
        }

        if ((homeGK.diveTimer || 0) <= 0) {
          homeGK.isDiving = false;
        }
      }

      // 4. ADVANCED RIVAL AI (Dribles, Pases, Sprints, Barridas, Tiros)
      aiPassTimer += delta;
      aiDribbleTimer += delta;

      let closestRivalIdx = 9;
      let minRivalDist = Infinity;
      awayPlayers.forEach((p, idx) => {
        if (p.isGoalkeeper) return;
        const d = p.group.position.distanceTo(ball.position);
        if (d < minRivalDist) {
          minRivalDist = d;
          closestRivalIdx = idx;
        }
      });

      awayPlayers.forEach((p, idx) => {
        if (p.isGoalkeeper) return;

        if (p.isKnockedDown) {
          p.knockdownTimer -= delta;
          p.group.rotation.x = -Math.PI / 2;
          if (p.knockdownTimer <= 0) {
            p.isKnockedDown = false;
            p.group.rotation.x = 0;
          }
          return;
        }

        const isHoldingBall = ballPossession && ballPossession.team === 'away' && ballPossession.index === idx;

        // AI SLIDE TACKLE: If user carries ball and rival defender is near
        if (!isHoldingBall && activeP && p.tackleTimer <= 0) {
          const distToUser = p.group.position.distanceTo(activeP.group.position);
          if (distToUser < 2.4 && ballPossession && ballPossession.team === 'home') {
            p.tackleTimer = 0.6;
            sounds.playTackle();

            // 30% chance rival commits a foul on user!
            if (Math.random() < 0.3) {
              const inRivalBox = activeP.group.position.z < -fieldLength / 2 + 24 && Math.abs(activeP.group.position.x) < 26;
              triggerFoul(inRivalBox, activeP.group.position, 'home');
              return;
            } else if (Math.random() < 0.65) {
              ballPossession = { team: 'away', index: idx };
              lastTouchTeamRef.current = 'away';
            }
          }
        }

        if (p.tackleTimer > 0) {
          p.tackleTimer -= delta;
          p.group.rotation.x = Math.PI / 3;
        } else {
          p.group.rotation.x = 0;
        }

        // AI DRIBBLE & SKILL MOVE: If rival carries ball and user presses closely
        if (isHoldingBall) {
          const distToUser = p.group.position.distanceTo(activeP.group.position);
          if (distToUser < 3.2 && aiDribbleTimer > 2.5) {
            // Perform agility dribble!
            aiDribbleTimer = 0;
            sounds.playDribble();
            const cutDir = Math.random() > 0.5 ? 1 : -1;
            p.group.position.x += cutDir * 1.8;
            p.group.position.z += 2.2;
          }
        }

        // AI PASS: If rival has teammate open ahead
        if (isHoldingBall && aiPassTimer > 3.0) {
          // Look for teammate with space
          let passTargetIdx = -1;
          for (let tm = 1; tm < awayPlayers.length; tm++) {
            if (tm !== idx && awayPlayers[tm].group.position.z > p.group.position.z) {
              passTargetIdx = tm;
              break;
            }
          }

          if (passTargetIdx !== -1 && Math.random() < 0.65) {
            aiPassTimer = 0;
            const targetP = awayPlayers[passTargetIdx];
            const pDir = new THREE.Vector3().subVectors(targetP.group.position, p.group.position).normalize();
            ballPossession = null;
            ballFreeTimer = 0.35;
            lastTouchTeamRef.current = 'away';
            ballVelocity.copy(pDir.multiplyScalar(0.9));
            sounds.playPass();
          }
        }

        // SPRINT BURST on counter attack
        const isRivalSprinting = isHoldingBall && p.group.position.z < 20;
        const currentAiSpeed = isRivalSprinting ? 0.38 : 0.23;

        if (isHoldingBall) {
          // Rival moves smoothly towards user goal (+Z) and FACES SOUTH!
          p.group.position.z += currentAiSpeed;
          p.group.rotation.y = Math.PI;

          // AI SHOOT: if near user goal
          if (p.group.position.z > fieldLength / 2 - 38) {
            ballPossession = null;
            ballFreeTimer = 0.4;
            lastTouchTeamRef.current = 'away';
            const shotTargetX = (Math.random() - 0.5) * 14;
            const kickDir = new THREE.Vector3(shotTargetX - ball.position.x, 0.26, fieldLength / 2 - ball.position.z).normalize();
            ballVelocity.copy(kickDir.multiplyScalar(0.95));
            sounds.playKick();
          }
        } else if (idx === closestRivalIdx) {
          const dir = new THREE.Vector3().subVectors(ball.position, p.group.position);
          dir.y = 0;
          if (dir.length() > 0.7) {
            dir.normalize().multiplyScalar(currentAiSpeed);
            p.group.position.add(dir);
            p.group.rotation.y = Math.atan2(dir.x, dir.z);
          }
        } else {
          // Position tactically
          const targetX = p.baseX + ball.position.x * 0.3;
          const targetZ = p.baseZ + ball.position.z * 0.4;
          const diff = new THREE.Vector3(targetX - p.group.position.x, 0, targetZ - p.group.position.z);
          if (diff.length() > 1.2) {
            diff.normalize().multiplyScalar(0.18);
            p.group.position.add(diff);
            p.group.rotation.y = Math.atan2(diff.x, diff.z);
          }
        }

        p.walkCycle += delta * (isRivalSprinting ? 14 : 7);
        p.leftLeg.rotation.x = Math.sin(p.walkCycle) * 0.45;
        p.rightLeg.rotation.x = -Math.sin(p.walkCycle) * 0.45;
      });

      // 5. AWAY GOALKEEPER (Defiende la portería Norte en z = -fieldLength / 2)
      const awayGK = awayPlayers[0];

      if (!awayGK.isDiving) {
        const targetAwayGkX = THREE.MathUtils.clamp(ball.position.x * 0.78, -goalW / 2 + 2.5, goalW / 2 - 2.5);
        awayGK.group.position.x = THREE.MathUtils.lerp(awayGK.group.position.x, targetAwayGkX, delta * 4.0);
        awayGK.group.position.y = THREE.MathUtils.lerp(awayGK.group.position.y, 0, delta * 6);
        awayGK.group.position.z = -fieldLength / 2 + 2.5;
        awayGK.group.rotation.y = Math.PI;
        awayGK.group.rotation.z = THREE.MathUtils.lerp(awayGK.group.rotation.z, 0, delta * 6);
        awayGK.leftArm.rotation.z = THREE.MathUtils.lerp(awayGK.leftArm.rotation.z, 0, delta * 6);
        awayGK.rightArm.rotation.z = THREE.MathUtils.lerp(awayGK.rightArm.rotation.z, 0, delta * 6);
        awayGK.leftLeg.rotation.z = THREE.MathUtils.lerp(awayGK.leftLeg.rotation.z, 0, delta * 6);
        awayGK.rightLeg.rotation.z = THREE.MathUtils.lerp(awayGK.rightLeg.rotation.z, 0, delta * 6);

        // Detect incoming user shot towards north goal and trigger dive!
        if (ball.position.z < -fieldLength / 2 + 42 && ballVelocity.z < -0.28) {
          const tToGoal = (-fieldLength / 2 - ball.position.z) / ballVelocity.z;
          const predictedX = ball.position.x + ballVelocity.x * tToGoal;
          const predictedY = Math.max(0.5, ball.position.y + ballVelocity.y * tToGoal);

          const isIncomingOnTarget = Math.abs(predictedX) < goalW / 2 + 1.2 && predictedY < goalH + 0.8;
          if (isIncomingOnTarget) {
            awayGK.isDiving = true;
            awayGK.diveTimer = Math.min(1.0, Math.max(0.65, tToGoal + 0.1));
            awayGK.diveDuration = awayGK.diveTimer;
            awayGK.diveTargetX = THREE.MathUtils.clamp(predictedX, -goalW / 2 + 1.5, goalW / 2 - 1.5);
            awayGK.diveTargetY = THREE.MathUtils.clamp(predictedY, 0.8, goalH - 0.8);
            awayGK.diveDir = Math.sign(predictedX - awayGK.group.position.x) || (Math.random() > 0.5 ? 1 : -1);
          }
        }
      } else {
        // Goalkeeper is diving through the air to block shot! ("El portero rival se tira a bloquear")
        awayGK.diveTimer = (awayGK.diveTimer || 0) - delta;
        const duration = awayGK.diveDuration || 0.9;
        const progress = Math.max(0, Math.min(1, 1 - (awayGK.diveTimer || 0) / duration));

        // Horizontal leap across goalmouth
        awayGK.group.position.x += ((awayGK.diveTargetX || 0) - awayGK.group.position.x) * delta * 7.5;
        // Parabolic vertical jump
        const jumpH = Math.sin(progress * Math.PI) * Math.min(4.0, (awayGK.diveTargetY || 1.5) * 0.9);
        awayGK.group.position.y = jumpH;
        // Horizontal mid-air tilt (facing north)
        awayGK.group.rotation.z = (awayGK.diveDir || 1) * 1.35 * Math.sin(progress * Math.PI);
        // Arms stretched out towards ball
        awayGK.leftArm.rotation.z = (awayGK.diveDir || 1) > 0 ? 1.85 : -1.85;
        awayGK.rightArm.rotation.z = (awayGK.diveDir || 1) > 0 ? 1.85 : -1.85;

        // Block shot check ("obviamente no todos")
        const gkDist = awayGK.group.position.distanceTo(ball.position);
        if (gkDist < 4.0 && (awayGK.diveTimer || 0) > 0.08 && ballVelocity.z < 0) {
          const isExtremeAngle = Math.abs(ball.position.x) > goalW / 2 - 2.5;
          const isHighScreamer = ball.position.y > goalH - 2.0;
          const saveChance = isExtremeAngle || isHighScreamer ? 0.35 : 0.72; // not all shots blocked!

          if (Math.random() < saveChance) {
            ballPossession = null;
            ballFreeTimer = 0.6;
            sounds.playSave();
            sounds.playCrowdGasp();
            lastTouchTeamRef.current = 'away';
            ballVelocity.z = 0.75 + Math.random() * 0.3;
            ballVelocity.x = (awayGK.diveDir || 1) * (0.6 + Math.random() * 0.5);
            ballVelocity.y = 0.25 + Math.random() * 0.3;
            setRefereeNotice({ type: 'foul', text: '🧤 ¡PARADÓN DEL PORTERO RIVAL!' });
            setTimeout(() => setRefereeNotice(null), 2000);
          }
        }

        if ((awayGK.diveTimer || 0) <= 0) {
          awayGK.isDiving = false;
        }
      }

      // 6. BALL PHYSICS & BOUNDARIES (SAQUE DE BANDA & TIRO DE ESQUINA)
      ball.position.add(ballVelocity);
      ballVelocity.multiplyScalar(0.978);
      ballVelocity.y -= 0.015;

      if (ball.position.y <= 0.58) {
        ball.position.y = 0.58;
        if (Math.abs(ballVelocity.y) > 0.05) {
          ballVelocity.y = -ballVelocity.y * 0.55;
          sounds.playBounce();
        } else {
          ballVelocity.y = 0;
        }
      }

      ball.rotation.x += ballVelocity.z * 1.5;
      ball.rotation.z -= ballVelocity.x * 1.5;

      // SAQUE DE BANDA (Ball leaves pitch laterally)
      if (Math.abs(ball.position.x) > fieldWidth / 2 + 0.8 && !setPieceCooldownRef.current) {
        triggerThrowIn(Math.sign(ball.position.x) * (fieldWidth / 2), ball.position.z);
      }

      // GOAL & CORNER / GOAL KICK CHECK (Arquería de 32m x 7.8m)
      const goalWidth = 32.0;
      const goalHeight = 7.8;
      const isInsideGoalX = Math.abs(ball.position.x) < goalWidth / 2;

      if (!goalCooldownRef.current) {
        // Player scores in North goal (z < -fieldLength / 2)
        if (ball.position.z < -fieldLength / 2 && isInsideGoalX && ball.position.y < goalHeight && ball.position.y > 0) {
          ballPossession = null;
          ballFreeTimer = 3.5;
          goalCooldownRef.current = true;
          setPlayerScore((s) => s + 1);
          if (onGoalScored) onGoalScored();
          setGoalAnnouncement({
            scorer: 'player',
            text: mode === 'training' ? '¡¡¡GOLAZO DE ENTRENAMIENTO!!! +10 MONEDAS 🪙' : '¡¡¡GOOOOL DEL EQUIPO!!!',
          });
          sounds.playGoalCelebration();
          confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });

          if (mode === 'training') {
            triggerTrainingSuccess('¡Golazo anotado en el entrenamiento!');
          }

          setTimeout(() => {
            setGoalAnnouncement(null);
            resetToKickoff();
            goalCooldownRef.current = false;
          }, 3500);
        }
        // AI Rival scores in South goal (z > fieldLength / 2)
        else if (ball.position.z > fieldLength / 2 && isInsideGoalX && ball.position.y < goalHeight && ball.position.y > 0) {
          ballPossession = null;
          ballFreeTimer = 3.5;
          goalCooldownRef.current = true;
          setAiScore((s) => s + 1);
          setGoalAnnouncement({ scorer: 'ai', text: '¡GOL DEL RIVAL!' });
          sounds.playGoalCelebration();

          setTimeout(() => {
            setGoalAnnouncement(null);
            resetToKickoff();
            goalCooldownRef.current = false;
          }, 3500);
        }
        // Endline crossed outside goal: Corner Kick vs Goal Kick
        else if (Math.abs(ball.position.z) > fieldLength / 2 + 0.8 && !setPieceCooldownRef.current) {
          if (mode === 'training') {
            setPieceCooldownRef.current = true;
            setTimeout(() => {
              if (setupTrainingDrillRef.current) setupTrainingDrillRef.current();
              setPieceCooldownRef.current = false;
            }, 1800);
            return;
          }
          const crossedNorth = ball.position.z < 0;
          if (crossedNorth) {
            // Crossed north endline
            if (lastTouchTeamRef.current === 'away') {
              // Away defender touched last -> Corner for Home!
              triggerCornerKick(ball.position.x > 0 ? fieldWidth / 2 : -fieldWidth / 2, -fieldLength / 2, true);
            } else {
              // Home attacker kicked out -> Goal kick for Away GK
              triggerGoalKick(true);
            }
          } else {
            // Crossed south endline
            if (lastTouchTeamRef.current === 'home') {
              // Home defender touched last -> Corner for Away!
              triggerCornerKick(ball.position.x > 0 ? fieldWidth / 2 : -fieldWidth / 2, fieldLength / 2, false);
            } else {
              // Away attacker kicked out -> Goal kick for Home GK
              triggerGoalKick(false);
            }
          }
        }
      }

      // Update Overhead Marker
      indicatorGroup.position.copy(activeP.group.position);
      arrow.rotation.y += delta * 3;

      // 7. CAMERA MODES (Tuned for monumental 175m x 110m pitch)
      if (cameraModeRef.current === 'follow') {
        const camTarget = activeP.group.position.clone();
        camera.position.lerp(new THREE.Vector3(camTarget.x, camTarget.y + 14, camTarget.z + 24), delta * 3.8);
        camera.lookAt(camTarget.x, camTarget.y + 1.2, camTarget.z - 6);
      } else if (cameraModeRef.current === 'tv') {
        const tvX = 66;
        const tvY = 34;
        const tvZ = ball.position.z * 0.55;
        camera.position.lerp(new THREE.Vector3(tvX, tvY, tvZ), delta * 2.5);
        camera.lookAt(ball.position.x * 0.35, 1.4, ball.position.z);
      } else {
        camera.position.set(0, 115, 6);
        camera.lookAt(0, 0, 0);
      }

      // 8. UPDATE CAMERA FLASHES & ANIMATED SPECTATORS (Aficionados saltando y tomando fotos)
      const matchTime = timer.getElapsed();
      const isExcited = goalAnnouncement !== null || activeSetPieceRef.current !== null;
      const jumpAmp = isExcited ? 1.3 : 0.7;

      cameraFlashes.forEach((flash) => {
        if (flash.activeTimer > 0) {
          flash.activeTimer -= delta;
          const intensity = Math.sin((flash.activeTimer / flash.duration) * Math.PI);
          flash.mesh.scale.setScalar(flash.baseScale * (1 + intensity * 2.2));
          (flash.mesh.material as THREE.MeshBasicMaterial).opacity = intensity;
          flash.mesh.visible = true;
        } else {
          flash.mesh.visible = false;
          flash.nextFlashIn -= delta;
          if (flash.nextFlashIn <= 0) {
            flash.activeTimer = flash.duration;
            flash.nextFlashIn = 0.35 + Math.random() * (isExcited ? 1.2 : 2.8);
          }
        }
      });

      spectators.forEach((fan) => {
        fan.group.position.y = fan.baseY + Math.abs(Math.sin(matchTime * fan.speed + fan.phase)) * jumpAmp;
        if (fan.isTakingPhoto) {
          fan.rightArm.rotation.x = -1.25 + Math.sin(matchTime * 4 + fan.phase) * 0.12;
          fan.leftArm.rotation.x = -1.15 + Math.cos(matchTime * 4 + fan.phase) * 0.12;
        } else {
          fan.leftArm.rotation.z = Math.sin(matchTime * (isExcited ? 12 : 5) + fan.phase) * 0.85;
          fan.rightArm.rotation.z = -Math.sin(matchTime * (isExcited ? 12 : 5) + fan.phase) * 0.85;
        }
        fan.group.lookAt(ball.position.x, fan.group.position.y, ball.position.z);
      });

      // 9. ENHANCED 2D RADAR MINIMAP - FULL STADIUM BOWL & TWINKLING FLASHES
      if (radarCanvasRef.current) {
        const cvs = radarCanvasRef.current;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, cvs.width, cvs.height);

          // 1. Outer Stadium Arena Background & Exterior Walls
          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, 0, cvs.width, cvs.height);

          // Stadium Bowl Rim
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(4, 4, cvs.width - 8, cvs.height - 8, 14);
          ctx.fill();
          ctx.strokeStyle = '#38bdf844';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Grandstand Seating Tiers on all 4 sides
          ctx.fillStyle = '#0f172a';
          // North Stand (top)
          ctx.fillRect(16, 8, cvs.width - 32, 16);
          // South Stand (bottom)
          ctx.fillRect(16, cvs.height - 24, cvs.width - 32, 16);
          // West Stand (left)
          ctx.fillRect(8, 20, 16, cvs.height - 40);
          // East Stand (right)
          ctx.fillRect(cvs.width - 24, 20, 16, cvs.height - 40);

          // Animated crowd speckles and twinkling camera flashes on the radar!
          for (let f = 0; f < 8; f++) {
            const flashActive = Math.sin(matchTime * 14 + f * 1.8) > 0.65;
            if (flashActive) {
              const fx = 12 + ((f * 37) % (cvs.width - 24));
              const fy = 10 + ((f * 53) % (cvs.height - 20));
              ctx.beginPath();
              ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#60a5fa';
              ctx.shadowBlur = 6;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }

          // 2. Pitch Lawn & Markings in Center
          const pitchMarginX = 25;
          const pitchMarginY = 25;
          const pWidth = cvs.width - pitchMarginX * 2;
          const pHeight = cvs.height - pitchMarginY * 2;

          ctx.fillStyle = '#15803d';
          ctx.fillRect(pitchMarginX, pitchMarginY, pWidth, pHeight);

          ctx.strokeStyle = '#ffffff88';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(pitchMarginX, pitchMarginY, pWidth, pHeight);

          // Midfield line & center circle
          ctx.beginPath();
          ctx.moveTo(pitchMarginX, cvs.height / 2);
          ctx.lineTo(pitchMarginX + pWidth, cvs.height / 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cvs.width / 2, cvs.height / 2, 9, 0, Math.PI * 2);
          ctx.stroke();

          // Penalty boxes
          const boxW = pWidth * 0.52;
          const boxH = pHeight * 0.15;
          // North box
          ctx.strokeRect((cvs.width - boxW) / 2, pitchMarginY, boxW, boxH);
          // South box
          ctx.strokeRect((cvs.width - boxW) / 2, pitchMarginY + pHeight - boxH, boxW, boxH);

          // Goalmouth lines (larger goals)
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 2.4;
          const goalLineW = pWidth * 0.34;
          ctx.beginPath();
          ctx.moveTo((cvs.width - goalLineW) / 2, pitchMarginY);
          ctx.lineTo((cvs.width + goalLineW) / 2, pitchMarginY);
          ctx.moveTo((cvs.width - goalLineW) / 2, pitchMarginY + pHeight);
          ctx.lineTo((cvs.width + goalLineW) / 2, pitchMarginY + pHeight);
          ctx.stroke();

          const mapX = (wx: number) => ((wx + fieldWidth / 2) / fieldWidth) * (pWidth - 6) + pitchMarginX + 3;
          const mapY = (wz: number) => ((wz + fieldLength / 2) / fieldLength) * (pHeight - 6) + pitchMarginY + 3;

          // Home players
          homePlayers.forEach((p, idx) => {
            const rx = mapX(p.group.position.x);
            const ry = mapY(p.group.position.z);

            ctx.beginPath();
            ctx.arc(rx, ry, idx === activePlayerIndexRef.current ? 4.8 : 3.0, 0, Math.PI * 2);
            ctx.fillStyle = p.isGoalkeeper ? '#facc15' : homeKit;
            ctx.fill();

            if (idx === activePlayerIndexRef.current) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.8;
              ctx.stroke();
            }
          });

          // Away players
          awayPlayers.forEach((p) => {
            const rx = mapX(p.group.position.x);
            const ry = mapY(p.group.position.z);

            ctx.beginPath();
            ctx.arc(rx, ry, 3.0, 0, Math.PI * 2);
            ctx.fillStyle = p.isGoalkeeper ? '#fb923c' : awayKit;
            ctx.fill();
          });

          // Ball with glowing outline
          const bx = mapX(ball.position.x);
          const by = mapY(ball.position.z);
          ctx.beginPath();
          ctx.arc(bx, by, 3.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 5;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // MATCH TIME & PERIOD CONTROLLER:
    // 1st Half (120s) -> 2nd Half (120s) -> Prórroga (120s if tied) -> Penaltis (if still tied)
    const timerInterval = setInterval(() => {
      if (isPausedRef.current || gameOverRef.current || isWalkoutRef.current) return;
      if (
        matchPeriodRef.current === 'half_time' ||
        matchPeriodRef.current === 'penalties' ||
        matchPeriodRef.current === 'finished'
      )
        return;

      timeRemainingRef.current -= 1;
      const currentSec = Math.max(0, timeRemainingRef.current);
      setTimeRemaining(currentSec);

      if (currentSec <= 0) {
        sounds.playWhistle(false);

        if (matchPeriodRef.current === '1st_half') {
          matchPeriodRef.current = 'half_time';
          setMatchPeriod('half_time');
          setRefereeNotice({ type: 'period', text: '⏸️ DESCANSO - FINAL DEL 1ER TIEMPO' });
        } else if (matchPeriodRef.current === '2nd_half') {
          if (playerScoreRef.current === aiScoreRef.current) {
            matchPeriodRef.current = 'extra_time';
            setMatchPeriod('extra_time');
            setRefereeNotice({ type: 'period', text: '⏱️ ¡PRÓRROGA! 2 Minutos de Tiempo Extra' });
            timeRemainingRef.current = 120;
            setTimeRemaining(120);
            resetToKickoff();
          } else {
            gameOverRef.current = true;
            setGameOver(true);
            matchPeriodRef.current = 'finished';
            setMatchPeriod('finished');
            const result = playerScoreRef.current > aiScoreRef.current ? 'win' : 'loss';
            if (onMatchComplete) onMatchComplete(result, playerScoreRef.current, aiScoreRef.current);
          }
        } else if (matchPeriodRef.current === 'extra_time') {
          if (playerScoreRef.current === aiScoreRef.current) {
            matchPeriodRef.current = 'penalties';
            setMatchPeriod('penalties');
            setRefereeNotice({ type: 'period', text: '🎯 ¡TANDA DE PENALTIS! Decisión a los 11 metros' });
          } else {
            gameOverRef.current = true;
            setGameOver(true);
            matchPeriodRef.current = 'finished';
            setMatchPeriod('finished');
            const result = playerScoreRef.current > aiScoreRef.current ? 'win' : 'loss';
            if (onMatchComplete) onMatchComplete(result, playerScoreRef.current, aiScoreRef.current);
          }
        }
      }
    }, 1000);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      sounds.stopStadiumCrowd();
      clearInterval(timerInterval);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Penalty Shootout Actions
  const handleUserPenaltyShot = (direction: 'left' | 'center' | 'right') => {
    const gkDive = ['left', 'center', 'right'][Math.floor(Math.random() * 3)];
    const isGoal = direction !== gkDive;

    if (isGoal) {
      sounds.playGoalCelebration();
      setPlayerScore((s) => s + 1);
      if (onGoalScored) onGoalScored();
      setPenaltyMessage(`¡¡GOOOL!! Tiraste a la ${direction} y engañaste al portero.`);
    } else {
      sounds.playSave();
      setPenaltyMessage(`¡PARADA! El portero adivinó la ${direction}.`);
    }

    const newHome = [...homePenalties, isGoal];
    setHomePenalties(newHome);

    // Switch to Rival's turn
    setTimeout(() => {
      setPenaltyTurn('rival');
      setPenaltyMessage('¡Turno del rival! Elige dónde lanzarte con tu portero.');
    }, 2000);
  };

  const handleUserGoalkeeperDive = (direction: 'left' | 'center' | 'right') => {
    const rivalShot = ['left', 'center', 'right'][Math.floor(Math.random() * 3)];
    const isSaved = direction === rivalShot;

    if (isSaved) {
      sounds.playSave();
      sounds.playCheer();
      setPenaltyMessage(`¡¡ATAJADA ÉPICA!! Adivinaste el tiro a la ${direction}.`);
    } else {
      sounds.playGoalCelebration();
      setAiScore((s) => s + 1);
      setPenaltyMessage(`Gol del rival a la ${rivalShot}.`);
    }

    const newAway = [...awayPenalties, !isSaved];
    setAwayPenalties(newAway);

    // Check shootout resolution
    const currentRound = penaltyRound + 1;
    setPenaltyRound(currentRound);

    setTimeout(() => {
      if (currentRound >= 5 && newHomePenaltyScore(homePenalties) !== newAwayPenaltyScore(newAway)) {
        // Shootout finished
        setGameOver(true);
        setMatchPeriod('finished');
        const userWon = newHomePenaltyScore(homePenalties) > newAwayPenaltyScore(newAway);
        if (userWon) confetti({ particleCount: 200, spread: 100 });
        if (onMatchComplete) onMatchComplete(userWon ? 'win' : 'loss', playerScore, aiScore);
      } else {
        setPenaltyTurn('user');
        setPenaltyMessage(`Ronda ${currentRound + 1}: Elige dirección para tu tiro.`);
      }
    }, 2000);
  };

  const newHomePenaltyScore = (arr: boolean[]) => arr.filter(Boolean).length;
  const newAwayPenaltyScore = (arr: boolean[]) => arr.filter(Boolean).length;

  const startSecondHalf = () => {
    matchPeriodRef.current = '2nd_half';
    setMatchPeriod('2nd_half');
    timeRemainingRef.current = 120;
    setTimeRemaining(120);
    setRefereeNotice(null);
    sounds.playWhistle(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* --- CINEMATIC TUNNEL WALKOUT OVERLAY --- */}
      {isWalkout && (
        <div className="absolute inset-0 pointer-events-auto flex flex-col justify-end p-6 z-30 bg-gradient-to-t from-black/80 via-transparent to-black/30">
          <div className="max-w-4xl mx-auto w-full pb-4">
            <div className="bg-slate-950/85 border border-white/20 p-5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-left">
                <div
                  className="w-12 h-12 rounded-xl border-2 border-white/40 shadow-lg flex items-center justify-center font-black text-lg text-white"
                  style={{ backgroundColor: team?.jerseyColor || '#2563eb' }}
                >
                  #{team?.playerNumber || 10}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sky-400 tracking-wider uppercase">11 TITULAR (4-3-3)</span>
                  <h3 className="text-white font-black text-lg tracking-wide uppercase">
                    {team?.teamName || 'Football Unit FC'}
                  </h3>
                  <p className="text-slate-300 text-xs flex items-center gap-1.5 flex-wrap">
                    <span>Capitán: <strong className="text-white">{team?.playerName || 'Capitán'}</strong></span>
                    {team?.playerGrl && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                        GRL {team.playerGrl}
                      </span>
                    )}
                    {team?.playerPosition && (
                      <span className="px-1.5 py-0.2 rounded bg-white/20 text-white font-black text-[10px]">
                        {team.playerPosition}
                      </span>
                    )}
                    <span>• 1 Portero + 10 Jugadores</span>
                  </p>
                </div>
              </div>

              <div className="text-amber-400 font-black text-xl italic px-3 py-1 rounded-lg bg-black/60 border border-white/10">
                VS
              </div>

              <div className="flex items-center gap-4 text-right sm:flex-row-reverse">
                <div
                  className="w-12 h-12 rounded-xl border-2 border-white/40 shadow-lg flex items-center justify-center font-black text-lg text-white"
                  style={{ backgroundColor: team?.rivalColor || '#dc2626' }}
                >
                  IA
                </div>
                <div>
                  <span className="text-[11px] font-bold text-rose-400 tracking-wider uppercase">RIVAL INTELIGENTE (4-3-3)</span>
                  <h3 className="text-white font-black text-lg tracking-wide uppercase">
                    AI Rivals Pro
                  </h3>
                  <p className="text-slate-300 text-xs">
                    Pases, Dribles, Sprints, Barreras y Barridas
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden mt-3 border border-white/10">
              <div
                ref={walkoutProgressBarRef}
                className="bg-amber-400 h-full transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(250,204,21,0.8)]"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- TOP SCOREBOARD WITH MATCH PERIOD --- */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {mode === 'training' ? (
          <div className="flex items-center gap-3 px-4 sm:px-6 py-2 rounded-2xl bg-slate-950/95 text-white backdrop-blur-md border border-emerald-500/40 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-emerald-300">
                ENTRENAMIENTO:{' '}
                {currentDrill === 'tiro_libre'
                  ? 'TIRO LIBRE'
                  : currentDrill === 'penaltis'
                  ? 'PENALTIS'
                  : currentDrill === 'pases'
                  ? 'PASES'
                  : currentDrill === 'tiros'
                  ? 'TIROS'
                  : currentDrill === 'regates'
                  ? 'REGATES'
                  : currentDrill === 'centros'
                  ? 'CENTROS'
                  : 'PRÁCTICA LIBRE'}
              </span>
            </div>

            <div className="h-4 w-px bg-white/20" />

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black text-[10px] tracking-wider uppercase">
                +10 🪙 POR GOL
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>+{trainingCoinsEarned} 🪙</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-slate-900/90 text-white backdrop-blur-md border border-white/15 shadow-2xl">
            {mode === 'multiplayer' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-[10px] tracking-wider uppercase mr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE 1v1</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/40"
                style={{ backgroundColor: team?.jerseyColor || '#2563eb' }}
              />
              <span className="font-black text-sm tracking-wider uppercase hidden sm:inline">
                {team?.teamName || 'Local'}
              </span>
              <span className="text-2xl font-black text-white ml-1">{playerScore}</span>
            </div>

            <div className="text-slate-500 font-black text-lg">-</div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white mr-1">{aiScore}</span>
              <span className="font-black text-sm tracking-wider uppercase hidden sm:inline truncate max-w-[100px]">
                {opponentName || opponentTeam?.teamName || (mode === 'multiplayer' ? 'Rival Online' : 'Rival IA')}
              </span>
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/40"
                style={{
                  backgroundColor:
                    opponentTeam?.jerseyColor || team?.rivalColor || '#dc2626',
                }}
              />
            </div>

            {/* Period Badge & Timer */}
            <div className="ml-3 pl-3 border-l border-white/10 flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider border bg-amber-500/20 text-amber-300 border-amber-400/30"
              >
                {matchPeriod === '1st_half'
                  ? '1T'
                  : matchPeriod === 'half_time'
                  ? 'DESCANSO'
                  : matchPeriod === '2nd_half'
                  ? '2T'
                  : matchPeriod === 'extra_time'
                  ? 'PRÓRROGA'
                  : matchPeriod === 'penalties'
                  ? 'PENALTIS'
                  : 'FINAL'}
              </span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {matchPeriod === 'penalties'
                  ? 'TANDA'
                  : formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <button
          onClick={() => {
            setCameraMode((curr) => (curr === 'tv' ? 'follow' : curr === 'follow' ? 'topDown' : 'tv'));
          }}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
          title="Cambiar perspectiva de cámara"
        >
          <Camera className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline capitalize">
            {cameraMode === 'tv' ? 'TV Broadcast' : cameraMode === 'follow' ? 'Cámara Acción' : 'Cenital'}
          </span>
        </button>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
          title={isPaused ? 'Reanudar' : 'Pausar'}
        >
          {isPaused ? <Play className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4 text-white" />}
        </button>

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
          title="Controles y ayuda"
        >
          <Info className="w-4 h-4 text-blue-400" />
        </button>

        {onExitToMenu && (
          <button
            onClick={() => setIsPaused(true)}
            className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
            title="Menú Principal"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>
        )}
      </div>

      {/* Active Player HUD Tag */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="bg-slate-900/85 border border-white/15 px-3 py-1.5 rounded-xl backdrop-blur-md text-white flex items-center gap-2 shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Control Automático: {HOME_LINEUP_BASE[activePlayerIndex]?.role} (
              {(() => {
                if (team?.lineup && team.lineup[activePlayerIndex]) {
                  const p = getPlayerById(team.lineup[activePlayerIndex]);
                  if (p) return p.shortName;
                }
                return activePlayerIndex === 9 ? team?.playerName || 'Capitán' : HOME_LINEUP_BASE[activePlayerIndex]?.name;
              })()}
            )
          </span>
        </div>
      </div>

      {/* Quick Controls Reminder Bar */}
      <div className="absolute top-16 left-4 z-20 hidden lg:flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-[11px] text-slate-300 shadow-xl">
        <span className="font-bold text-amber-400">D/A/W/S:</span> Mover |{' '}
        <span className="font-bold text-amber-400">E:</span> Barrida |{' '}
        <span className="font-bold text-sky-400">Q:</span> Driblear |{' '}
        <span className="font-bold text-rose-400">Click Izq (Mantener):</span> Apuntar y Cargar Tiro (se eleva con potencia) |{' '}
        <span className="font-bold text-emerald-400">Click Der (Mantener):</span> Apuntar y Pasar |{' '}
        <span className="font-bold text-amber-300">🧤 Portero:</span> Se tira a tapar tiros
      </div>

      {/* Floating Mouse Aim & Power Bar */}
      <div
        ref={powerBarContainerRef}
        className="fixed pointer-events-none z-50 hidden flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-14"
        style={{ left: 0, top: 0 }}
      >
        <div className="bg-slate-950/95 border-2 border-white/30 px-3.5 py-2 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col items-center gap-1 min-w-[155px]">
          <span ref={powerBarLabelRef} className="text-[11px] font-black uppercase tracking-wider text-amber-300 drop-shadow">
            ⚡ POTENCIA: 0%
          </span>
          <div className="w-full bg-slate-800/90 h-3 rounded-full overflow-hidden p-0.5 border border-white/20">
            <div
              ref={powerBarFillRef}
              className="h-full rounded-full transition-none bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              style={{ width: '0%' }}
            />
          </div>
        </div>
      </div>

      {/* --- ACTIVE SET-PIECE EXECUTION CARD (PAUSA EL JUEGO PARA COBRAR) --- */}
      {activeSetPiece ? (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 animate-bounce">
          <div className="px-8 py-3.5 rounded-2xl shadow-2xl border-2 flex items-center gap-3 backdrop-blur-md font-black uppercase tracking-wider text-sm sm:text-base bg-slate-950/95 border-amber-500 text-amber-200">
            {activeSetPiece.type === 'penalty' ? (
              <AlertTriangle className="w-6 h-6 text-rose-400 animate-pulse" />
            ) : activeSetPiece.type === 'corner' ? (
              <CornerDownRight className="w-6 h-6 text-sky-400" />
            ) : (
              <Flag className="w-6 h-6 text-amber-400" />
            )}
            <span>{activeSetPiece.title}</span>
          </div>

          {activeSetPiece.team === 'home' && (
            <div className="flex items-center gap-3 bg-slate-900/95 border border-amber-400/40 p-2.5 rounded-2xl backdrop-blur-md shadow-2xl">
              <button
                onClick={() => executeSetPieceHandlerRef.current && executeSetPieceHandlerRef.current('shoot')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase shadow-xl active:scale-95 transition-all flex items-center gap-2"
              >
                <Trophy className="w-4 h-4 fill-slate-950" />
                <span>
                  {activeSetPiece.type === 'penalty'
                    ? '🎯 ¡PATEAR PENALTI!'
                    : activeSetPiece.type === 'corner'
                    ? '🚩 CENTRAR AL ÁREA'
                    : activeSetPiece.type === 'throwin'
                    ? '📣 SACAR DE BANDA'
                    : '⚡ TIRAR A PORTERÍA'}
                </span>
              </button>

              {activeSetPiece.type !== 'penalty' && (
                <button
                  onClick={() => executeSetPieceHandlerRef.current && executeSetPieceHandlerRef.current('pass')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Shield className="w-4 h-4 text-white" />
                  <span>Pase en Corto</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : refereeNotice ? (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce">
          <div className="px-8 py-3.5 rounded-2xl shadow-2xl border-2 flex items-center gap-3 backdrop-blur-md font-black uppercase tracking-wider text-sm sm:text-base bg-slate-950/95 border-amber-500 text-amber-200">
            {refereeNotice.type === 'penalty' ? (
              <AlertTriangle className="w-6 h-6 text-rose-400 animate-pulse" />
            ) : refereeNotice.type === 'corner' ? (
              <CornerDownRight className="w-6 h-6 text-sky-400" />
            ) : (
              <Flag className="w-6 h-6 text-amber-400" />
            )}
            <span>{refereeNotice.text}</span>
          </div>
        </div>
      ) : null}

      {/* --- TRAINING SUCCESS CELEBRATION NOTIFICATION --- */}
      {trainingRewardNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-auto">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 p-4 sm:p-5 rounded-3xl shadow-2xl border-2 border-white flex flex-col items-center gap-2 max-w-md text-center">
            <div className="flex items-center gap-2 font-black text-sm sm:text-base uppercase tracking-wider">
              <Trophy className="w-6 h-6 fill-slate-950" />
              <span>{trainingRewardNotification.title}</span>
            </div>
            <p className="text-xs font-bold text-slate-950">
              {trainingRewardNotification.subtitle}
            </p>
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-300 font-black text-xs flex items-center gap-1.5 shadow">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>+{trainingRewardNotification.coins} Monedas Acreditadas</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setTrainingRewardNotification(null);
                  if (setupTrainingDrillRef.current) setupTrainingDrillRef.current();
                }}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs uppercase shadow flex items-center gap-1.5 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Repetir Tiro (+10 🪙)</span>
              </button>
              <button
                onClick={() => setTrainingDrillSelectorOpen(true)}
                className="px-3 py-2 rounded-xl bg-white/40 hover:bg-white/60 text-slate-950 font-black text-xs uppercase shadow flex items-center gap-1 active:scale-95"
              >
                <span>Otro Ejercicio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- IN-GAME TRAINING DRILL SELECTOR MODAL --- */}
      {trainingDrillSelectorOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-slate-950 border-2 border-amber-400/50 p-5 sm:p-6 rounded-3xl max-w-lg w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base sm:text-lg uppercase">Cambiar Ejercicio en Cancha</h3>
              </div>
              <button
                onClick={() => setTrainingDrillSelectorOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Selecciona el entrenamiento que tu jugador realizará directamente en el campo. ¡Ganas <strong>10 monedas</strong> por cada acierto!:
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'tiro_libre', name: 'Tiro Libre', badge: 'Con Barrera', color: 'border-amber-400/40 text-amber-300' },
                { id: 'penaltis', name: 'Penaltis', badge: '1 vs 1 Portero', color: 'border-rose-400/40 text-rose-300' },
                { id: 'pases', name: 'Pases', badge: 'Precisión', color: 'border-emerald-400/40 text-emerald-300' },
                { id: 'tiros', name: 'Tiros a Puerta', badge: 'Media Distancia', color: 'border-sky-400/40 text-sky-300' },
                { id: 'regates', name: 'Regates', badge: 'Fintas y Dribles', color: 'border-purple-400/40 text-purple-300' },
                { id: 'centros', name: 'Centros y Remates', badge: 'Juego Aéreo', color: 'border-orange-400/40 text-orange-300' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    sounds.playBounce();
                    setCurrentDrill(d.id);
                    currentDrillRef.current = d.id;
                    setTrainingDrillSelectorOpen(false);
                    setTrainingRewardNotification(null);
                    if (onSwitchTrainingDrillRef.current) onSwitchTrainingDrillRef.current(d.id);
                    if (setupTrainingDrillRef.current) setupTrainingDrillRef.current(d.id);
                  }}
                  className={`p-3 rounded-2xl bg-slate-900/90 border ${d.color} hover:bg-slate-800 text-left transition-all active:scale-95 group flex flex-col justify-between`}
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400">{d.badge}</div>
                  <div className="font-black text-sm text-white group-hover:text-amber-300">{d.name}</div>
                  <div className="text-[10px] text-amber-400 font-black mt-1">+10 🪙</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setTrainingDrillSelectorOpen(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* --- FLOATING TRAINING DRILL CONTROLS ON PITCH --- */}
      {mode === 'training' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[96%] max-w-3xl pointer-events-auto flex flex-col items-center gap-2">
          <div className="w-full bg-slate-950/95 border-2 border-emerald-500/50 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-2xl flex flex-col gap-2.5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-emerald-300">
                  {currentDrill === 'tiro_libre'
                    ? '🎯 Tiro Libre: Supera la barrera y anota gol (+10 🪙)'
                    : currentDrill === 'penaltis'
                    ? '🚨 Penalti: Bate al portero desde los 11 metros (+10 🪙)'
                    : currentDrill === 'pases'
                    ? '⚡ Pases: Conecta con tus compañeros (+10 🪙)'
                    : currentDrill === 'tiros'
                    ? '🚀 Tiros: Disparo potente fuera del área (+10 🪙)'
                    : currentDrill === 'regates'
                    ? '🪄 Regates: Desborda rivales y anota (+10 🪙)'
                    : currentDrill === 'centros'
                    ? '🚩 Centros: Envía al área para cabecear (+10 🪙)'
                    : '⚽ Práctica Libre en el Estadio (+10 🪙)'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    sounds.playBounce();
                    if (setupTrainingDrillRef.current) setupTrainingDrillRef.current();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 flex items-center gap-1 active:scale-95"
                  title="Colocar pelota de nuevo"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Reset Balón</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playBounce();
                    setTrainingDrillSelectorOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center gap-1 active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cambiar Ejercicio</span>
                </button>
              </div>
            </div>

            {/* Quick Action Skill Buttons for this drill */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              {currentDrill === 'tiro_libre' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tl_comba')}
                    className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                  >
                    <Target className="w-3.5 h-3.5 fill-slate-950" />
                    <span>🎯 Comba al Ángulo</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tl_potente')}
                    className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>💥 Empeine Potente</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tl_raso')}
                    className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>👟 Raso por Abajo</span>
                  </button>
                </>
              )}

              {currentDrill === 'penaltis' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pen_izq')}
                    className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <span>🎯 Ángulo Izq</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pen_der')}
                    className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <span>🎯 Ángulo Der</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pen_panenka')}
                    className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                    <span>✨ Panenka</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pen_fuerte')}
                    className="flex-1 min-w-[100px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <span>💥 Cañonazo</span>
                  </button>
                </>
              )}

              {currentDrill === 'pases' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pase_raso')}
                    className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>👟 Pase Raso al Pie</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('pase_filtrado')}
                    className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>🚀 Pase Filtrado al Hueco</span>
                  </button>
                </>
              )}

              {currentDrill === 'tiros' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tiro_bomba')}
                    className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>🚀 Bomba Lejana</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tiro_colocado')}
                    className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <Target className="w-3.5 h-3.5 fill-slate-950" />
                    <span>🎯 Tiro Colocado</span>
                  </button>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('tiro_volea')}
                    className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🔥 Volea al Primer Toque</span>
                  </button>
                </>
              )}

              {currentDrill === 'regates' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('regate_bicicleta')}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Bicicleta & Disparo a Puerta</span>
                  </button>
                </>
              )}

              {currentDrill === 'centros' && (
                <>
                  <button
                    onClick={() => executeTrainingActionRef.current && executeTrainingActionRef.current('centro_area')}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>🚩 Centro al Área y Cabeceo</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- HALF TIME MODAL --- */}
      {matchPeriod === 'half_time' && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/20 p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl text-center">
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wider">⏸️ FINAL DEL 1ER TIEMPO</h3>
            <p className="text-sm text-slate-300 mb-6">Gran primera parte. ¡Prepárate para los segundos 2 minutos!</p>

            <div className="flex items-center justify-center gap-6 bg-slate-950/60 p-4 rounded-xl border border-white/10 mb-6">
              <div>
                <div className="text-xs text-blue-400 font-semibold uppercase">{team?.teamName || 'Equipo'}</div>
                <div className="text-3xl font-black text-white">{playerScore}</div>
              </div>
              <div className="text-2xl text-slate-600">-</div>
              <div>
                <div className="text-xs text-rose-400 font-semibold uppercase">AI Rivals</div>
                <div className="text-3xl font-black text-white">{aiScore}</div>
              </div>
            </div>

            <button
              onClick={startSecondHalf}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 font-black text-slate-950 uppercase tracking-wider shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Comenzar Segundo Tiempo (2 mins)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* --- PENALTY SHOOTOUT INTERACTIVE UI --- */}
      {matchPeriod === 'penalties' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-between p-6 z-40">
          {/* Top Shootout Scoreboard */}
          <div className="max-w-2xl mx-auto w-full bg-slate-900/90 border border-amber-500/40 p-4 rounded-2xl shadow-2xl text-center">
            <h2 className="text-white font-black uppercase tracking-wider text-base sm:text-lg mb-2">
              🎯 Tanda de Penaltis Oficial
            </h2>

            <div className="flex items-center justify-around">
              {/* Home Penalties */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-sky-400 mb-1">{team?.teamName || 'Local'}</span>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-full border border-white/30 ${
                        homePenalties[i] === true
                          ? 'bg-emerald-400'
                          : homePenalties[i] === false
                          ? 'bg-rose-500'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="text-2xl font-black text-white">
                {newHomePenaltyScore(homePenalties)} - {newAwayPenaltyScore(awayPenalties)}
              </div>

              {/* Away Penalties */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-rose-400 mb-1">Rival</span>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-full border border-white/30 ${
                        awayPenalties[i] === true
                          ? 'bg-emerald-400'
                          : awayPenalties[i] === false
                          ? 'bg-rose-500'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-amber-300 text-xs font-semibold mt-3 animate-pulse">{penaltyMessage}</p>
          </div>

          {/* Bottom Shootout Actions */}
          <div className="max-w-md mx-auto w-full pb-8">
            {penaltyTurn === 'user' ? (
              <div className="bg-slate-950/90 border border-white/20 p-5 rounded-2xl text-center shadow-2xl backdrop-blur-md">
                <h4 className="text-white font-bold text-sm mb-3">Tu Turno de Tirar: Elige Dirección</h4>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleUserPenaltyShot('left')}
                    className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Izquierda
                  </button>
                  <button
                    onClick={() => handleUserPenaltyShot('center')}
                    className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Centro
                  </button>
                  <button
                    onClick={() => handleUserPenaltyShot('right')}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Derecha
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/90 border border-white/20 p-5 rounded-2xl text-center shadow-2xl backdrop-blur-md">
                <h4 className="text-white font-bold text-sm mb-3">Tira el Rival: Elige Dónde Lanzarte con el Portero</h4>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleUserGoalkeeperDive('left')}
                    className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Lanzar Izq
                  </button>
                  <button
                    onClick={() => handleUserGoalkeeperDive('center')}
                    className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Aguantar Centro
                  </button>
                  <button
                    onClick={() => handleUserGoalkeeperDive('right')}
                    className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase shadow-lg active:scale-95 transition-all"
                  >
                    Lanzar Der
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 2D RADAR MINIMAP (Estadio Entero con Tribunas y Flashes) --- */}
      <div className="absolute bottom-6 right-6 z-20 hidden md:block">
        <div className="bg-slate-950/85 p-2 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md">
          <canvas ref={radarCanvasRef} width={150} height={210} className="rounded-xl" />
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-medium px-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team?.jerseyColor || '#2563eb' }} />
              11 Local
            </span>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">🏟️ Estadio</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team?.rivalColor || '#dc2626' }} />
              11 Rival
            </span>
          </div>
        </div>
      </div>

      {/* --- GOAL ANNOUNCEMENT BANNER --- */}
      {goalAnnouncement && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-950 font-black text-3xl sm:text-5xl px-12 py-6 rounded-3xl shadow-[0_0_60px_rgba(234,179,8,0.8)] border-4 border-white animate-bounce uppercase tracking-widest text-center">
            {goalAnnouncement.text}
          </div>
        </div>
      )}



      {/* --- PAUSE MODAL --- */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl text-center">
            <h3 className="text-xl font-bold text-white mb-2">Partido Pausado</h3>
            <p className="text-sm text-slate-400 mb-6">Football Unit • Estadio Monumental 175m x 110m</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                Continuar
              </button>

              {onExitToMenu && (
                <button
                  onClick={() => {
                    setIsPaused(false);
                    onExitToMenu(true, playerScore, aiScore);
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-950/80 border border-rose-800/50 hover:bg-rose-900/80 font-medium text-rose-200 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                >
                  <Home className="w-4 h-4" />
                  Abandonar y Salir al Menú
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RIVAL ABANDONED OVERLAY */}
      {rivalAbandoned && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-gradient-to-b from-zinc-900 to-black border-2 border-emerald-500/50 p-6 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-[0_20px_60px_rgba(16,185,129,0.3)]">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
              ¡VICTORIA POR ABANDONO!
            </h3>
            <p className="text-sm text-zinc-300 mb-4">
              Tu rival se ha desconectado o ha abandonado el partido online. ¡Se te otorga la victoria oficial!
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-sm mb-6">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>+100 Monedas Oficiales</span>
            </div>
            {onExitToMenu && (
              <button
                onClick={() => {
                  sounds.playCheer();
                  if (onMatchComplete) onMatchComplete('win', playerScore + 1, aiScore);
                  onExitToMenu(false, playerScore + 1, aiScore);
                }}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Reclamar Recompensa y Salir</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- GAME OVER MODAL --- */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/20 p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-white mb-1">
              {playerScore > aiScore ? '¡VICTORIA ÉPICA!' : playerScore < aiScore ? 'DERROTA' : '¡EMPATE!'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {matchPeriod === 'finished' && (homePenalties.length > 0 || awayPenalties.length > 0)
                ? '¡Definido en la tanda de penaltis!'
                : playerScore > aiScore
                ? '¡Tu equipo de 11 se impuso con clase!'
                : 'Gran batalla táctica de 11 contra 11.'}
            </p>

            <div className="flex items-center justify-center gap-6 bg-slate-950/60 p-4 rounded-xl border border-white/10 mb-4">
              <div>
                <div className="text-xs text-blue-400 font-semibold uppercase">{team?.teamName || 'Equipo'}</div>
                <div className="text-3xl font-black text-white">{playerScore}</div>
              </div>
              <div className="text-2xl text-slate-600">-</div>
              <div>
                <div className="text-xs text-rose-400 font-semibold uppercase">AI Rivals</div>
                <div className="text-3xl font-black text-white">{aiScore}</div>
              </div>
            </div>

            {playerScore > aiScore && (
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-sm shadow-lg animate-pulse">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>+100 Monedas Ganadas por Victoria</span>
              </div>
            )}

            <div className="space-y-3">
              {onExitToMenu && (
                <button
                  onClick={() => {
                    onExitToMenu(false, playerScore, aiScore);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Volver al Menú Principal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CONTROLS & HELP MODAL --- */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Controles y Reglas Oficiales
            </h3>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Delante:</span>
                <span className="font-mono text-amber-400">Tecla D o Flecha Arriba</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Atrás:</span>
                <span className="font-mono text-amber-400">Tecla A o Flecha Abajo</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Izquierda:</span>
                <span className="font-mono text-amber-400">Tecla W o Flecha Izquierda</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Derecha:</span>
                <span className="font-mono text-amber-400">Tecla S o Flecha Derecha</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Barrida (robar balón):</span>
                <span className="font-mono text-amber-400">Tecla E</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Driblear (dejar rival tirado):</span>
                <span className="font-mono text-purple-400">Tecla Q</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Pasar la pelota:</span>
                <span className="font-mono text-emerald-400">Click Derecho (Mantener para cargar pase bombeado)</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Tirar a portería:</span>
                <span className="font-mono text-rose-400">Click Izq (Mantener para cargar tiro potente y alto)</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">Sprint / Correr:</span>
                <span className="font-mono text-sky-400">Shift</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-950/40 rounded-xl border border-blue-500/20 text-xs text-blue-200 space-y-1.5">
              <div>
                🎯 <strong>Apuntar y Cargar con el Ratón:</strong> Haz click donde quieras tirar o pasar. Mantén presionado para llenar la barra de potencia. Con mucha fuerza, el balón se eleva hacia la escuadra o techa a los rivales.
              </div>
              <div>
                🧤 <strong>Porteros Acrobáticos y Arquería Más Grande:</strong> La portería ahora mide 32m x 7.8m. Los porteros se tiran en plancha por el aire para bloquear tiros difíciles (¡pero no todos!).
              </div>
              <div>
                ⏱️ <strong>Estructura del Partido:</strong> 1er Tiempo (2 mins) + 2do Tiempo (2 mins). Prórroga y Penaltis si hay empate.
              </div>
              <div>
                🚩 <strong>Saques y Faltas:</strong> Saque de banda, córner, tiros libres con barrera y fueras de juego.
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
