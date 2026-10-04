import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX, RotateCcw, Play, Pause, Trophy, Info, Camera, Home } from 'lucide-react';
import { sounds } from '../utils/audio';
import { createSoccerBallTexture, createGrassTexture } from '../utils/textures';
import { TeamCustomization } from '../types/game';

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'timed' | 'firstToFive' | 'practice';
export type CameraMode = 'follow' | 'tv' | 'topDown';

interface FootballGameProps {
  team?: TeamCustomization;
  onShowLoading?: () => void;
  onExitToMenu?: (abandoned: boolean, pScore: number, aScore: number) => void;
  onMatchComplete?: (result: 'win' | 'loss' | 'tie', pScore: number, aScore: number) => void;
}

export default function FootballGame({
  team,
  onShowLoading,
  onExitToMenu,
  onMatchComplete,
}: FootballGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Game UI State
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [goalAnnouncement, setGoalAnnouncement] = useState<{ scorer: 'player' | 'ai'; text: string } | null>(null);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('normal');
  const [gameMode, setGameMode] = useState<GameMode>('firstToFive');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [showHelp, setShowHelp] = useState(false);
  const [isKickActive, setIsKickActive] = useState(false);

  // Virtual Joystick State for Touch/Mouse
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const virtualInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [joystickThumb, setJoystickThumb] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs for Game Loop access
  const isPausedRef = useRef(false);
  const gameOverRef = useRef(false);
  const difficultyRef = useRef<GameDifficulty>('normal');
  const gameModeRef = useRef<GameMode>('firstToFive');
  const cameraModeRef = useRef<CameraMode>('follow');
  const goalCooldownRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Main Three.js Setup & Game Loop
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Cielo azul
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(20, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Subtle sun flare light from opposite side
    const fillLight = new THREE.DirectionalLight(0xa5f3fc, 0.25);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    // --- Field Dimensions (from user's code: 40 width x 60 length) ---
    const fieldWidth = 40;
    const fieldLength = 60;

    // Grass Pitch with striped texture
    const grassTexture = createGrassTexture();
    grassTexture.repeat.set(1, 1);
    const fieldGeometry = new THREE.PlaneGeometry(fieldWidth, fieldLength);
    const fieldMaterial = new THREE.MeshStandardMaterial({
      map: grassTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    // Outer Grass Border
    const outerGrassGeom = new THREE.PlaneGeometry(fieldWidth + 16, fieldLength + 16);
    const outerGrassMat = new THREE.MeshStandardMaterial({ color: 0x1f663c, roughness: 0.95 });
    const outerGrass = new THREE.Mesh(outerGrassGeom, outerGrassMat);
    outerGrass.position.y = -0.05;
    outerGrass.rotation.x = -Math.PI / 2;
    outerGrass.receiveShadow = true;
    scene.add(outerGrass);

    // --- Pitch Markings ---
    const markingsGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Touchlines and Goal lines (perimeter)
    const createLineWidth = (w: number, l: number, x: number, z: number) => {
      const g = new THREE.PlaneGeometry(w, l);
      const m = new THREE.Mesh(g, lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, z);
      markingsGroup.add(m);
    };

    const lw = 0.25; // line width
    // Sidelines
    createLineWidth(lw, fieldLength, -fieldWidth / 2 + 0.2, 0);
    createLineWidth(lw, fieldLength, fieldWidth / 2 - 0.2, 0);
    // Goal lines
    createLineWidth(fieldWidth, lw, 0, -fieldLength / 2 + 0.2);
    createLineWidth(fieldWidth, lw, 0, fieldLength / 2 - 0.2);
    // Halfway line
    createLineWidth(fieldWidth, lw, 0, 0);

    // Center circle
    const centerCircleGeom = new THREE.RingGeometry(4.8, 5.0, 48);
    const centerCircle = new THREE.Mesh(centerCircleGeom, lineMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.set(0, 0.02, 0);
    markingsGroup.add(centerCircle);

    // Center spot
    const centerSpotGeom = new THREE.CircleGeometry(0.35, 16);
    const centerSpot = new THREE.Mesh(centerSpotGeom, lineMat);
    centerSpot.rotation.x = -Math.PI / 2;
    centerSpot.position.set(0, 0.02, 0);
    markingsGroup.add(centerSpot);

    // Penalty areas (North and South)
    const createPenaltyArea = (zCenter: number, isNorth: boolean) => {
      const boxW = 16;
      const boxL = 9;
      const zEdge = isNorth ? -fieldLength / 2 + boxL : fieldLength / 2 - boxL;
      // Front line
      createLineWidth(boxW, lw, 0, zEdge);
      // Sides
      const sideZ = isNorth ? -fieldLength / 2 + boxL / 2 : fieldLength / 2 - boxL / 2;
      createLineWidth(lw, boxL, -boxW / 2, sideZ);
      createLineWidth(lw, boxL, boxW / 2, sideZ);

      // Penalty spot
      const spotZ = isNorth ? -fieldLength / 2 + 7 : fieldLength / 2 - 7;
      const spot = new THREE.Mesh(centerSpotGeom, lineMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(0, 0.02, spotZ);
      markingsGroup.add(spot);
    };

    createPenaltyArea(-fieldLength / 2, true);
    createPenaltyArea(fieldLength / 2, false);

    scene.add(markingsGroup);

    // --- Stadium Ad Boards & Grandstands ---
    const stadiumGroup = new THREE.Group();
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    
    // Perimeter boards
    const createBoard = (w: number, h: number, x: number, z: number, rotY: number = 0) => {
      const g = new THREE.BoxGeometry(w, h, 0.4);
      const b = new THREE.Mesh(g, boardMat);
      b.position.set(x, h / 2, z);
      b.rotation.y = rotY;
      b.castShadow = true;
      b.receiveShadow = true;
      stadiumGroup.add(b);
    };

    // Lateral boards
    createBoard(fieldLength + 4, 1.2, -fieldWidth / 2 - 2, 0, Math.PI / 2);
    createBoard(fieldLength + 4, 1.2, fieldWidth / 2 + 2, 0, Math.PI / 2);
    // End boards (leaving gap for goal)
    createBoard(12, 1.2, -14, -fieldLength / 2 - 2);
    createBoard(12, 1.2, 14, -fieldLength / 2 - 2);
    createBoard(12, 1.2, -14, fieldLength / 2 + 2);
    createBoard(12, 1.2, 14, fieldLength / 2 + 2);

    scene.add(stadiumGroup);

    // --- Goals / Porterías ---
    function createGoal(zPos: number, isNorth: boolean) {
      const goalGroup = new THREE.Group();
      const postMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.6,
      });

      const postGeom = new THREE.CylinderGeometry(0.2, 0.2, 4, 16);
      const crossbarGeom = new THREE.CylinderGeometry(0.2, 0.2, 10, 16);

      const leftPost = new THREE.Mesh(postGeom, postMaterial);
      leftPost.position.set(-5, 2, 0);
      leftPost.castShadow = true;

      const rightPost = new THREE.Mesh(postGeom, postMaterial);
      rightPost.position.set(5, 2, 0);
      rightPost.castShadow = true;

      const crossbar = new THREE.Mesh(crossbarGeom, postMaterial);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, 4, 0);
      crossbar.castShadow = true;

      goalGroup.add(leftPost, rightPost, crossbar);

      // Goal net structure behind
      const netDepth = 3;
      const netMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });

      const netBackGeom = new THREE.PlaneGeometry(10, 4, 10, 4);
      const netBack = new THREE.Mesh(netBackGeom, netMat);
      netBack.position.set(0, 2, isNorth ? -netDepth : netDepth);
      if (!isNorth) netBack.rotation.y = Math.PI;

      const netTopGeom = new THREE.PlaneGeometry(10, netDepth, 10, 3);
      const netTop = new THREE.Mesh(netTopGeom, netMat);
      netTop.rotation.x = Math.PI / 2;
      netTop.position.set(0, 4, isNorth ? -netDepth / 2 : netDepth / 2);

      goalGroup.add(netBack, netTop);

      goalGroup.position.z = zPos;
      scene.add(goalGroup);
    }

    createGoal(-fieldLength / 2, true);  // Arco Norte (IA defiende)
    createGoal(fieldLength / 2, false); // Arco Sur (Jugador defiende)

    // --- Corner Flags ---
    const flagPoleGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.8);
    const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    const flagClothGeom = new THREE.PlaneGeometry(0.6, 0.4);
    const flagClothMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });

    const addCornerFlag = (x: number, z: number) => {
      const flagG = new THREE.Group();
      const pole = new THREE.Mesh(flagPoleGeom, flagPoleMat);
      pole.position.y = 0.9;
      const cloth = new THREE.Mesh(flagClothGeom, flagClothMat);
      cloth.position.set(0.3, 1.5, 0);
      flagG.add(pole, cloth);
      flagG.position.set(x, 0, z);
      scene.add(flagG);
    };

    addCornerFlag(-fieldWidth / 2 + 0.2, -fieldLength / 2 + 0.2);
    addCornerFlag(fieldWidth / 2 - 0.2, -fieldLength / 2 + 0.2);
    addCornerFlag(-fieldWidth / 2 + 0.2, fieldLength / 2 - 0.2);
    addCornerFlag(fieldWidth / 2 - 0.2, fieldLength / 2 - 0.2);

    // --- Entities: Player, AI Rival, Ball ---

    // Jugador (CapsuleGeometry with custom jersey color)
    const playerGeom = new THREE.CapsuleGeometry(0.8, 1.2, 8, 16);
    const playerMat = new THREE.MeshStandardMaterial({
      color: team?.jerseyColor ? new THREE.Color(team.jerseyColor) : 0x2563eb,
      roughness: 0.4,
      metalness: 0.1,
    });
    const player = new THREE.Mesh(playerGeom, playerMat);
    player.position.set(0, 1.4, 15);
    player.castShadow = true;
    player.receiveShadow = true;

    // Player styling detail (visor / number band)
    const visorGeom = new THREE.BoxGeometry(0.7, 0.25, 0.4);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2 });
    const playerVisor = new THREE.Mesh(visorGeom, visorMat);
    playerVisor.position.set(0, 0.7, -0.65);
    player.add(playerVisor);

    scene.add(player);

    // IA Rival (Rojo)
    const aiMat = new THREE.MeshStandardMaterial({
      color: team?.rivalColor ? new THREE.Color(team.rivalColor) : 0xdc2626,
      roughness: 0.4,
      metalness: 0.1,
    });
    const aiRival = new THREE.Mesh(playerGeom, aiMat);
    aiRival.position.set(0, 1.4, -15);
    aiRival.castShadow = true;
    aiRival.receiveShadow = true;

    const aiVisor = new THREE.Mesh(visorGeom, new THREE.MeshStandardMaterial({ color: 0x7f1d1d }));
    aiVisor.position.set(0, 0.7, 0.65);
    aiRival.add(aiVisor);

    scene.add(aiRival);

    // Pelota (SphereGeometry(0.6, 32, 32))
    const ballTexture = createSoccerBallTexture();
    const ballGeom = new THREE.SphereGeometry(0.6, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.35,
      metalness: 0.05,
    });
    const ball = new THREE.Mesh(ballGeom, ballMat);
    ball.position.set(0, 0.6, 0);
    ball.castShadow = true;
    ball.receiveShadow = true;
    scene.add(ball);

    const ballVelocity = new THREE.Vector3(0, 0, 0);

    // Keys State
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'Space') {
        setIsKickActive(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'Space') {
        setIsKickActive(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Sound whistle at start
    sounds.playWhistle(true);

    // --- Reset Positions helper ---
    function resetPositions() {
      ball.position.set(0, 0.6, 0);
      ballVelocity.set(0, 0, 0);
      player.position.set(0, 1.4, 15);
      aiRival.position.set(0, 1.4, -15);
    }

    // --- Player Movement & Kick ---
    function handlePlayerMovement() {
      const speed = 0.25;
      const moveVector = new THREE.Vector3(0, 0, 0);

      // Keyboard Controls
      if (keys['KeyW'] || keys['ArrowUp']) moveVector.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) moveVector.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) moveVector.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveVector.x += 1;

      // Virtual Joystick Controls
      if (virtualInputRef.current.x !== 0 || virtualInputRef.current.z !== 0) {
        moveVector.x += virtualInputRef.current.x;
        moveVector.z += virtualInputRef.current.z;
      }

      if (moveVector.lengthSq() > 0) {
        moveVector.normalize().multiplyScalar(speed);
        player.position.add(moveVector);

        // Turn player slightly in movement direction
        player.rotation.y = Math.atan2(moveVector.x, moveVector.z) + Math.PI;
      }

      // Field limits for player
      player.position.x = Math.max(-fieldWidth / 2 + 1, Math.min(fieldWidth / 2 - 1, player.position.x));
      player.position.z = Math.max(-fieldLength / 2 + 1, Math.min(fieldLength / 2 - 1, player.position.z));

      // Player Kick (Space or on-screen kick button)
      const kickPressed = keys['Space'] || isKickActive;
      if (kickPressed) {
        const distToBall = player.position.distanceTo(ball.position);
        if (distToBall < 2.0) {
          const kickDir = new THREE.Vector3().subVectors(ball.position, player.position).normalize();
          kickDir.y = 0.22; // Elevación leve
          ballVelocity.add(kickDir.multiplyScalar(0.85));
          sounds.playKick();
        }
      }
    }

    // --- AI Movement & Logic ---
    function handleAIMovement() {
      // Difficulty tuning
      let aiSpeed = 0.15;
      let kickPower = 0.5;

      if (difficultyRef.current === 'easy') {
        aiSpeed = 0.12;
        kickPower = 0.42;
      } else if (difficultyRef.current === 'hard') {
        aiSpeed = 0.19;
        kickPower = 0.65;
      }

      const targetPos = ball.position.clone();

      // Strategic AI positioning
      const dirToBall = new THREE.Vector3().subVectors(targetPos, aiRival.position);
      dirToBall.y = 0;

      if (dirToBall.length() > 0.5) {
        dirToBall.normalize().multiplyScalar(aiSpeed);
        aiRival.position.add(dirToBall);

        // Rotate AI towards ball
        aiRival.rotation.y = Math.atan2(dirToBall.x, dirToBall.z);
      }

      // Limits for AI inside field
      aiRival.position.x = Math.max(-fieldWidth / 2 + 1, Math.min(fieldWidth / 2 - 1, aiRival.position.x));
      aiRival.position.z = Math.max(-fieldLength / 2 + 1, Math.min(fieldLength / 2 - 1, aiRival.position.z));

      // AI kick towards player's goal (Z positive)
      if (aiRival.position.distanceTo(ball.position) < 1.8) {
        // Aim toward open side of player's goal
        const goalTargetX = (Math.random() - 0.5) * 6; // Spread within goal posts
        const kickDir = new THREE.Vector3(goalTargetX * 0.05, 0.12, 1).normalize();
        ballVelocity.add(kickDir.multiplyScalar(kickPower));
        sounds.playKick();
      }
    }

    // --- Physics & Goal Detection ---
    function updatePhysics() {
      // Movement and friction
      ball.position.add(ballVelocity);
      ballVelocity.multiplyScalar(0.95); // Friction resistance

      // Ball Rolling rotation animation based on velocity
      const ballRadius = 0.6;
      ball.rotation.x += ballVelocity.z / ballRadius;
      ball.rotation.z -= ballVelocity.x / ballRadius;

      // Ball gravity if elevated
      if (ball.position.y > 0.6) {
        ball.position.y += ballVelocity.y;
        ballVelocity.y -= 0.015; // Gravity
        if (ball.position.y <= 0.6) {
          ball.position.y = 0.6;
          ballVelocity.y = -ballVelocity.y * 0.5; // Bounce dampen
          if (Math.abs(ballVelocity.y) > 0.05) sounds.playBounce();
        }
      }

      // Collision player / AI with ball
      [player, aiRival].forEach((entity) => {
        const dist = entity.position.distanceTo(ball.position);
        if (dist < 1.4) {
          const pushDir = new THREE.Vector3().subVectors(ball.position, entity.position).normalize();
          pushDir.y = 0;
          ballVelocity.add(pushDir.multiplyScalar(0.12));
        }
      });

      // Goal Check
      // Goal posts are between x: -5 and 5, depth beyond fieldLength / 2
      if (Math.abs(ball.position.x) < 5 && Math.abs(ball.position.z) > fieldLength / 2) {
        if (!goalCooldownRef.current) {
          goalCooldownRef.current = true;
          const playerScored = ball.position.z < 0;

          if (playerScored) {
            setPlayerScore((prev) => {
              const updated = prev + 1;
              if (gameModeRef.current === 'firstToFive' && updated >= 5) {
                setGameOver(true);
              }
              return updated;
            });
            setGoalAnnouncement({ scorer: 'player', text: '¡¡¡GOOOOOOL DE JUGADOR!!!' });
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#3b82f6', '#60a5fa', '#ffffff', '#fbbf24'],
            });
          } else {
            setAiScore((prev) => {
              const updated = prev + 1;
              if (gameModeRef.current === 'firstToFive' && updated >= 5) {
                setGameOver(true);
              }
              return updated;
            });
            setGoalAnnouncement({ scorer: 'ai', text: '¡Gol del Rival IA!' });
          }

          sounds.playCheer();

          setTimeout(() => {
            resetPositions();
            setGoalAnnouncement(null);
            goalCooldownRef.current = false;
            sounds.playWhistle(true);
          }, 2400);
        }
      }

      // Field Border Bouncing
      if (Math.abs(ball.position.x) > fieldWidth / 2 - 0.6) {
        ballVelocity.x *= -0.8;
        ball.position.x = Math.sign(ball.position.x) * (fieldWidth / 2 - 0.6);
        sounds.playBounce();
      }
      if (Math.abs(ball.position.z) > fieldLength / 2 - 0.6 && Math.abs(ball.position.x) >= 5) {
        ballVelocity.z *= -0.8;
        ball.position.z = Math.sign(ball.position.z) * (fieldLength / 2 - 0.6);
        sounds.playBounce();
      }
    }

    // --- Dynamic Camera ---
    function updateCamera() {
      if (cameraModeRef.current === 'follow') {
        // Camera smoothly follows player from an elevated angle (as in user's prototype)
        const targetX = player.position.x * 0.5;
        const targetY = player.position.y + 20;
        const targetZ = player.position.z + 20;

        camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
        camera.lookAt(player.position.x, 0, player.position.z - 5);
      } else if (cameraModeRef.current === 'tv') {
        // TV Broadcast side angle following the ball
        camera.position.set(28, 22, ball.position.z * 0.4);
        camera.lookAt(ball.position.x * 0.5, 0, ball.position.z);
      } else if (cameraModeRef.current === 'topDown') {
        // Tactical top-down view
        camera.position.set(0, 52, 2);
        camera.lookAt(0, 0, 0);
      }
    }

    // --- Animation Loop ---
    let animationFrameId: number;
    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      if (!isPausedRef.current && !gameOverRef.current) {
        handlePlayerMovement();
        handleAIMovement();
        updatePhysics();
      }

      updateCamera();
      renderer.render(scene, camera);
    }

    animate();

    // Window Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Match Countdown Timer for 'timed' mode
  useEffect(() => {
    if (gameMode !== 'timed' || isPaused || gameOver) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          sounds.playWhistle(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameMode, isPaused, gameOver]);

  // Trigger match completion callback when game over
  useEffect(() => {
    if (gameOver && onMatchComplete) {
      const result = playerScore > aiScore ? 'win' : playerScore < aiScore ? 'loss' : 'tie';
      onMatchComplete(result, playerScore, aiScore);
    }
  }, [gameOver, playerScore, aiScore, onMatchComplete]);

  // Restart match handler
  const handleRestart = () => {
    setPlayerScore(0);
    setAiScore(0);
    setTimeRemaining(180);
    setGameOver(false);
    setIsPaused(false);
    setGoalAnnouncement(null);
    sounds.playWhistle(true);
  };

  // Virtual Joystick Event Handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    joystickCenterRef.current = { x: clientX, y: clientY };
    setIsJoystickActive(true);
    setJoystickThumb({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isJoystickActive || !joystickCenterRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const maxRadius = 45;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;
    setJoystickThumb({ x: thumbX, y: thumbY });

    // Normalize input between -1 and 1
    virtualInputRef.current = {
      x: thumbX / maxRadius,
      z: thumbY / maxRadius,
    };
  };

  const handleTouchEnd = () => {
    setIsJoystickActive(false);
    joystickCenterRef.current = null;
    setJoystickThumb({ x: 0, y: 0 });
    virtualInputRef.current = { x: 0, z: 0 };
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Main Scoreboard HUD (faithful to prototype with polished UI) */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/15 shadow-2xl text-white z-20">
        {/* Player Score */}
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
          <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">Jugador</span>
          <span className="text-2xl font-black text-white">{playerScore}</span>
        </div>

        <div className="text-white/30 text-lg font-light">vs</div>

        {/* AI Score */}
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-black text-white">{aiScore}</span>
          <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold">IA</span>
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
        </div>

        {/* Game Mode / Timer Indicator */}
        <div className="h-6 w-px bg-white/20 mx-1" />
        <div className="text-xs font-mono font-medium text-amber-300">
          {gameMode === 'timed' ? formatTime(timeRemaining) : gameMode === 'firstToFive' ? 'Primero a 5' : 'Práctica'}
        </div>
      </header>

      {/* Quick Controls & Settings Bar (Top-Right) */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
          title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
        </button>

        <button
          onClick={() => {
            const nextMode: Record<CameraMode, CameraMode> = {
              follow: 'tv',
              tv: 'topDown',
              topDown: 'follow',
            };
            setCameraMode(nextMode[cameraMode]);
          }}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
          title="Cambiar perspectiva de cámara"
        >
          <Camera className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline capitalize">{cameraMode === 'follow' ? 'Cámara 3D' : cameraMode === 'tv' ? 'TV Lateral' : 'Cenital'}</span>
        </button>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
          title={isPaused ? 'Reanudar' : 'Pausar'}
        >
          {isPaused ? <Play className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4 text-white" />}
        </button>

        <button
          onClick={handleRestart}
          className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
          title="Reiniciar partido"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
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
            onClick={() => {
              setIsPaused(true);
            }}
            className="p-2.5 rounded-xl bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur-md border border-white/10 transition-colors"
            title="Menú Principal"
          >
            <Home className="w-4 h-4 text-emerald-400" />
          </button>
        )}
      </div>

      {/* Difficulty and Mode Switcher (Top-Left) */}
      <div className="absolute top-4 left-4 hidden sm:flex items-center gap-1 bg-slate-950/70 backdrop-blur-md p-1 rounded-xl border border-white/10 text-xs z-20">
        {(['easy', 'normal', 'hard'] as GameDifficulty[]).map((level) => (
          <button
            key={level}
            onClick={() => setDifficulty(level)}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              difficulty === level
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {level === 'easy' ? 'Fácil' : level === 'normal' ? 'Normal' : 'Difícil'}
          </button>
        ))}
      </div>

      {/* Desktop Controls Hint (matching user's prototype styling) */}
      <aside
        id="controls-hint"
        className="absolute bottom-5 left-5 hidden md:block bg-black/75 backdrop-blur-md text-white px-4 py-3 rounded-xl text-xs border border-white/15 leading-relaxed z-10 shadow-lg pointer-events-none"
      >
        <div className="font-semibold text-sky-400 mb-1">Controles:</div>
        <div><strong className="text-white">W, A, S, D</strong> o <strong className="text-white">Flechas</strong>: Mover jugador</div>
        <div><strong className="text-white">Espacio</strong>: Chutar el balón</div>
      </aside>

      {/* Mobile / Touch On-Screen Controls */}
      <div className="md:hidden absolute bottom-6 left-6 z-20">
        {/* Virtual Joystick Base */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-28 h-28 rounded-full bg-slate-950/70 border border-white/20 backdrop-blur-md flex items-center justify-center touch-none shadow-2xl"
        >
          <div
            className="w-12 h-12 rounded-full bg-blue-500/80 border border-blue-300 shadow-md transition-transform"
            style={{
              transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Touch Kick Button */}
      <div className="md:hidden absolute bottom-8 right-8 z-20">
        <button
          onTouchStart={() => setIsKickActive(true)}
          onTouchEnd={() => setIsKickActive(false)}
          onMouseDown={() => setIsKickActive(true)}
          onMouseUp={() => setIsKickActive(false)}
          className={`w-20 h-20 rounded-full font-bold text-white text-sm shadow-2xl active:scale-95 transition-all flex flex-col items-center justify-center border-2 ${
            isKickActive
              ? 'bg-amber-500 border-amber-300 scale-95 shadow-[0_0_20px_#f59e0b]'
              : 'bg-blue-600/90 border-blue-400/60'
          }`}
        >
          <span>CHUTE</span>
          <span className="text-[10px] opacity-75 font-normal">Golpear</span>
        </button>
      </div>

      {/* Goal Celebration Banner */}
      {goalAnnouncement && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-r from-blue-900/90 via-slate-900/95 to-rose-900/90 px-10 py-6 rounded-3xl border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.5)] backdrop-blur-xl text-center transform scale-110">
            <h2 className="text-4xl sm:text-5xl font-black text-amber-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-wider">
              {goalAnnouncement.text}
            </h2>
            <p className="text-sm font-medium text-white/80 mt-1 uppercase tracking-widest">
              {goalAnnouncement.scorer === 'player' ? '¡Excelente remate!' : '¡A recuperar el balón!'}
            </p>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl text-center">
            <h3 className="text-xl font-bold text-white mb-2">Partido Pausado</h3>
            <p className="text-sm text-slate-400 mb-6">Football Unit - Partido Individual</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                Continuar
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar Partido
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
              {onShowLoading && (
                <button
                  onClick={() => {
                    setIsPaused(false);
                    onShowLoading();
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 font-medium text-slate-300 transition-colors flex items-center justify-center gap-2 text-xs"
                >
                  Ver Pantalla de Carga
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/20 p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-white mb-1">
              {playerScore > aiScore ? '¡VICTORIA!' : playerScore < aiScore ? 'DERROTA' : '¡EMPATE!'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {playerScore > aiScore
                ? '¡Has vencido a la IA con una gran actuación!'
                : playerScore < aiScore
                ? 'La IA se llevó el triunfo esta vez.'
                : 'Un partido muy parejo de ida y vuelta.'}
            </p>

            {/* Final Score Board */}
            <div className="flex items-center justify-center gap-6 bg-slate-950/60 p-4 rounded-xl border border-white/10 mb-6">
              <div>
                <div className="text-xs text-blue-400 font-semibold uppercase">Jugador</div>
                <div className="text-3xl font-black text-white">{playerScore}</div>
              </div>
              <div className="text-2xl text-slate-600">-</div>
              <div>
                <div className="text-xs text-rose-400 font-semibold uppercase">IA Rival</div>
                <div className="text-3xl font-black text-white">{aiScore}</div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Jugar Revancha
              </button>

              {onExitToMenu && (
                <button
                  onClick={() => {
                    onExitToMenu(false, playerScore, aiScore);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Home className="w-4 h-4" />
                  Volver al Menú Principal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls & Help Dialog */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Cómo Jugar a Football Unit
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <p>
                <strong>Objetivo:</strong> Conduce el balón y anótale goles a la IA en la portería norte.
              </p>
              <div className="p-3 bg-slate-950/70 rounded-xl space-y-1.5 border border-white/10">
                <div className="font-semibold text-white">Controles en Teclado:</div>
                <div>• <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">W</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">A</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">S</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">D</kbd> o Flechas: Moverse</div>
                <div>• <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs">Espacio</kbd>: Chutar con fuerza cuando estés cerca del balón</div>
              </div>

              <div className="p-3 bg-slate-950/70 rounded-xl space-y-1.5 border border-white/10">
                <div className="font-semibold text-white">Controles Táctiles (Móvil / Tablet):</div>
                <div>• Joystick virtual en la esquina inferior izquierda para desplazarte.</div>
                <div>• Botón "CHUTE" en la esquina inferior derecha para patear.</div>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-semibold text-white rounded-xl transition-colors"
            >
              ¡Entendido, a jugar!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
