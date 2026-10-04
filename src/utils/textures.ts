import * as THREE from 'three';

// Generate a classic soccer ball canvas texture
export function createSoccerBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Black pentagon/hexagon patterns
  ctx.fillStyle = '#18181b';
  
  const drawPentagon = (x: number, y: number, radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Seam lines
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 3;

  const positions = [
    [64, 64], [192, 64], [320, 64], [448, 64],
    [128, 140], [256, 140], [384, 140],
    [64, 210], [192, 210], [320, 210], [448, 210]
  ];

  positions.forEach(([x, y]) => {
    drawPentagon(x, y, 22);
  });

  // Texture details
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Generate field grass stripes texture
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const stripes = 12;
  const stripeHeight = canvas.height / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#27804d' : '#227244';
    ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
