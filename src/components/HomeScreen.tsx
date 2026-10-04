import React from 'react';
import fieldCardImage from '../assets/images/field_equipo_card_1791086991368.jpg';
import { sounds } from '../utils/audio';

interface HomeScreenProps {
  unreadMailCount: number;
  onPlay: () => void;
  onOpenTeam: () => void;
  onOpenShop: () => void;
  onOpenMailbox: () => void;
}

export default function HomeScreen({
  unreadMailCount,
  onPlay,
  onOpenTeam,
  onOpenShop,
  onOpenMailbox,
}: HomeScreenProps) {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#800000] select-none font-sans flex flex-col justify-between">
      {/* Background with Exact Red Circular Elements from the Video */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Flat Deep Red Base */}
        <div className="absolute inset-0 bg-[#800000]" />

        {/* Top Circles Row */}
        {/* Circle 1 (Top Left) */}
        <div
          className="absolute rounded-full bg-[#e60000]"
          style={{ left: '11%', top: '4%', width: '9vw', height: '9vw', minWidth: '70px', minHeight: '70px' }}
        />

        {/* Circle 2 (Top Center-Left) */}
        <div
          className="absolute rounded-full bg-[#e60000]"
          style={{ left: '40%', top: '6%', width: '6.5vw', height: '6.5vw', minWidth: '50px', minHeight: '50px' }}
        />

        {/* Circle 3 (Top Center-Right) */}
        <div
          className="absolute rounded-full bg-[#e60000]"
          style={{ left: '64%', top: '4%', width: '9.5vw', height: '9.5vw', minWidth: '75px', minHeight: '75px' }}
        />

        {/* Circle 4 (Top Right) */}
        <div
          className="absolute rounded-full bg-[#e60000]"
          style={{ left: '87%', top: '8%', width: '9vw', height: '9vw', minWidth: '70px', minHeight: '70px' }}
        />

        {/* Middle Half-Circle / Oval (Center Bottom Area) */}
        <div
          className="absolute bg-[#e60000] rounded-t-full"
          style={{ left: '38%', top: '63%', width: '6vw', height: '3vw', minWidth: '50px', minHeight: '26px' }}
        />

        {/* Bottom Right Dark Curve from the Video */}
        <div
          className="absolute bg-[#520000] rounded-tl-full"
          style={{ right: 0, bottom: 0, width: '22vw', height: '18vh', minWidth: '160px', minHeight: '110px' }}
        />
      </div>

      {/* Main Content Area (EQUIPO Field Card on Left + Soccer Ball on Right) */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-between px-8 sm:px-16 md:px-24">
        {/* Left Side: EQUIPO Soccer Field Card & Player Silhouette */}
        <div className="flex flex-col items-center ml-2 sm:ml-6 md:ml-12 mt-4 sm:mt-8">
          {/* Soccer Field Card with "EQUIPO" */}
          <button
            onClick={() => {
              sounds.playBounce();
              onOpenTeam();
            }}
            className="relative w-56 sm:w-72 md:w-88 lg:w-96 h-36 sm:h-44 md:h-52 lg:h-56 rounded-none overflow-hidden border-2 border-black/80 shadow-2xl transition-transform hover:scale-[1.02] active:scale-98 cursor-pointer focus:outline-none"
            title="Personalizar Equipo"
          >
            {/* Field Image */}
            <img
              src={fieldCardImage}
              alt="Campo de Fútbol"
              className="w-full h-full object-cover"
            />

            {/* "EQUIPO" Big Bold Black Text Centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest text-black/90 uppercase drop-shadow-[0_1px_3px_rgba(255,255,255,0.4)]">
                EQUIPO
              </span>
            </div>
          </button>

          {/* Player Dribbling Ball Silhouette (Exact as in Video) */}
          <div
            onClick={() => {
              sounds.playBounce();
              onOpenTeam();
            }}
            className="mt-4 sm:mt-6 w-16 h-20 sm:w-20 sm:h-24 md:w-24 md:h-28 text-black cursor-pointer transition-transform hover:scale-105 active:scale-95"
            title="Personalizar Equipo"
          >
            <svg
              viewBox="0 0 100 120"
              fill="currentColor"
              className="w-full h-full filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            >
              {/* Head */}
              <circle cx="56" cy="18" r="9" />
              {/* Torso */}
              <path d="M48 27 L66 29 L58 60 L44 58 Z" />
              {/* Left Arm trailing */}
              <path d="M48 30 L32 45 L35 50 L50 36 Z" />
              {/* Right Arm forward */}
              <path d="M64 31 L80 44 L77 49 L62 38 Z" />
              {/* Left Leg */}
              <path d="M46 58 L28 85 L34 88 L52 64 Z" />
              <path d="M28 85 L20 104 L26 106 L34 88 Z" />
              {/* Right Leg */}
              <path d="M58 59 L66 84 L58 87 L52 62 Z" />
              <path d="M66 84 L72 106 L78 105 L72 84 Z" />
              {/* Ball */}
              <circle cx="82" cy="112" r="7" />
              <circle cx="82" cy="112" r="3.5" fill="#ffffff" />
            </svg>
          </div>
        </div>

        {/* Right Side: Big Soccer Ball Resting with Flat Base (Exact from Video) */}
        <div className="relative mr-4 sm:mr-10 md:mr-20 mt-6 sm:mt-10 flex items-center justify-center">
          <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80">
            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl">
              {/* Clip path for flat resting bottom if desired, or full ball */}
              <g>
                {/* Ball White Base */}
                <circle cx="100" cy="100" r="88" fill="#ffffff" stroke="#000000" strokeWidth="4" />

                {/* Central Black Pentagon */}
                <polygon
                  points="100,68 128,88 117,120 83,120 72,88"
                  fill="#000000"
                />

                {/* Lines radiating from Pentagon corners */}
                <line x1="100" y1="68" x2="100" y2="14" stroke="#000000" strokeWidth="4" />
                <line x1="128" y1="88" x2="182" y2="70" stroke="#000000" strokeWidth="4" />
                <line x1="117" y1="120" x2="152" y2="170" stroke="#000000" strokeWidth="4" />
                <line x1="83" y1="120" x2="48" y2="170" stroke="#000000" strokeWidth="4" />
                <line x1="72" y1="88" x2="18" y2="70" stroke="#000000" strokeWidth="4" />

                {/* Top Outer Pentagons / Patches */}
                <polygon points="80,18 100,14 120,18 126,38 74,38" fill="#000000" />
                <polygon points="170,64 182,70 186,94 165,108 152,90" fill="#000000" />
                <polygon points="144,162 152,170 134,185 116,183 124,162" fill="#000000" />
                <polygon points="56,162 48,170 66,185 84,183 76,162" fill="#000000" />
                <polygon points="30,64 18,70 14,94 35,108 48,90" fill="#000000" />

                {/* Additional Seam Lines connecting edge panels */}
                <line x1="126" y1="38" x2="152" y2="90" stroke="#000000" strokeWidth="3.5" />
                <line x1="74" y1="38" x2="48" y2="90" stroke="#000000" strokeWidth="3.5" />
                <line x1="165" y1="108" x2="144" y2="162" stroke="#000000" strokeWidth="3.5" />
                <line x1="35" y1="108" x2="56" y2="162" stroke="#000000" strokeWidth="3.5" />
                <line x1="124" y1="162" x2="76" y2="162" stroke="#000000" strokeWidth="3.5" />
              </g>

              {/* Bottom Ground Cut/Shadow matching the video's flat base */}
              <rect x="50" y="184" width="100" height="16" fill="#800000" />
              <line x1="50" y1="184" x2="150" y2="184" stroke="#000000" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar (Exact Green Bar with Black Border from Video) */}
      <footer className="relative z-20 w-full bg-[#00a84f] border-t-[3px] border-black py-3 sm:py-4 px-6 sm:px-16 flex items-center justify-around text-black font-black select-none">
        {/* 1. JUGAR Button with Soccer Player Icon */}
        <button
          onClick={() => {
            sounds.playKick();
            onPlay();
          }}
          className="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-6 py-1 rounded transition-transform active:scale-95 group focus:outline-none"
        >
          <span className="text-2xl sm:text-3xl md:text-4xl tracking-wider uppercase font-black">
            JUGAR
          </span>

          {/* Running/Kicking Player Silhouette Icon (Exact from Video) */}
          <div className="w-7 h-7 sm:w-9 sm:h-9 text-black">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <circle cx="16" cy="4.5" r="2.2" />
              <path d="M14 7.5 L18 8.5 L16 13.5 L13 12.5 Z" />
              <path d="M13 12.5 L9 16.5 L7 20.5 L9 20.5 L11 17.5 L14 14.5 Z" />
              <path d="M16 13.5 L19 17.5 L22 20.5 L23 19.5 L20 15.5 Z" />
              {/* Ball */}
              <circle cx="5" cy="20" r="2.2" />
            </svg>
          </div>
        </button>

        {/* 2. TIENDA Button with Shopping Cart Icon */}
        <button
          onClick={() => {
            sounds.playBounce();
            onOpenShop();
          }}
          className="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-6 py-1 rounded transition-transform active:scale-95 group focus:outline-none"
        >
          <span className="text-2xl sm:text-3xl md:text-4xl tracking-wider uppercase font-black">
            TIENDA
          </span>

          {/* Shopping Cart Icon (Exact from Video) */}
          <div className="w-7 h-7 sm:w-9 sm:h-9 text-black">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M7 18 C5.9 18 5 18.9 5 20 C5 21.1 5.9 22 7 22 C8.1 22 9 21.1 9 20 C9 18.9 8.1 18 7 18 Z M17 18 C15.9 18 15 18.9 15 20 C15 21.1 15.9 22 17 22 C18.1 22 19 21.1 19 20 C19 18.9 18.1 18 17 18 Z M7.2 14.8 L7.2 14.7 L8.1 13 L15.5 13 C16.2 13 16.9 12.6 17.2 12 L21.1 5 L19.3 4 L15.5 11 L8.5 11 L4.3 2 L1 2 L1 4 L3 4 L6.6 11.6 L5.2 14 C4.5 15.3 5.5 17 7 17 L19 17 L19 15 L7 15 C6.9 15 6.8 14.9 6.8 14.8 Z" />
            </svg>
          </div>
        </button>

        {/* 3. BUZÓN Button with Mail Envelope Icon & RED NOTIFICATION DOT */}
        <button
          onClick={() => {
            sounds.playBounce();
            onOpenMailbox();
          }}
          className="relative flex items-center gap-2.5 sm:gap-4 px-3 sm:px-6 py-1 rounded transition-transform active:scale-95 group focus:outline-none"
        >
          <span className="text-2xl sm:text-3xl md:text-4xl tracking-wider uppercase font-black">
            BUZÓN
          </span>

          {/* Mail Envelope Icon (Exact from Video with inner flap lines) */}
          <div className="relative w-8 h-7 sm:w-10 sm:h-8 text-black">
            <svg viewBox="0 0 28 22" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
              {/* Envelope outer rectangle */}
              <rect x="1.5" y="1.5" width="25" height="19" rx="1" fill="none" />
              {/* Envelope V flap */}
              <polyline points="2,2 14,13 26,2" />
              {/* Bottom fold accents */}
              <line x1="2" y1="20" x2="10" y2="11" />
              <line x1="26" y1="20" x2="18" y2="11" />
            </svg>

            {/* Red Notification Dot (when unread items exist, as requested by user) */}
            {unreadMailCount > 0 && (
              <span
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-[0_0_8px_#dc2626] animate-pulse"
                title={`${unreadMailCount} mensajes sin leer`}
              />
            )}
          </div>
        </button>
      </footer>
    </div>
  );
}
