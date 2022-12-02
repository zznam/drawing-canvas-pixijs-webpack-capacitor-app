import _ from 'lodash';
import * as dat from 'dat.gui';
import * as PIXI from 'pixi.js';
import SpritePool from './SpritePool';
import BrushGenerator from './BrushGenerator';
import {Camera, CameraResultType} from '@capacitor/camera';
import './style.css';
import Icon from './assets/play-button.png';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri
  });

  // image.webPath will contain a path that can be set as an image src.
  // You can access the original file using image.path, which can be
  // passed to the Filesystem API to read the raw data of the image,
  // if desired (or pass resultType: CameraResultType.Base64 to getPhoto)
  var imageUrl = image.webPath;

  // Can be set to the src of an image now
  imageElement.src = imageUrl;
};

function component() {
  const element = document.createElement('button');

  // Lodash, now imported by this script
  element.innerHTML = _.join(['Take', 'picture! '], ' ');
  element.classList.add('hello');
  element.addEventListener('click', takePicture);
  // Add the image to our existing div.
  const myIcon = new Image(32, 32);
  myIcon.src = Icon;

  element.appendChild(myIcon);

  return element;
}

document.body.appendChild(component());


const gui = new dat.GUI();

const guiParams = {
  brushSize: 48,
  brushColor: 0x2ecc71,
  brushSmoothing: 0.5,
  useEraser: false,
};

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0xffffff,
});
document.body.appendChild(app.view);

const drawBuffer = new PIXI.Container();
const renderTexture = PIXI.RenderTexture.create({width: 1024, height: 1024});

const spritePool = new SpritePool();
const brushGenerator = new BrushGenerator(app.renderer);
let brushTexture = null;

init();

async function init() {

  const frameSprite = new PIXI.Sprite(
    PIXI.Texture.from('https://i.imgur.com/MA56x4i.png')
  );
  frameSprite.anchor.set(0.5);
  frameSprite.width = app.screen.height / 2 + 2;
  frameSprite.height = app.screen.height / 2 + 2;
  frameSprite.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(frameSprite);

  const sprite = new PIXI.Sprite(renderTexture);
  sprite.anchor.set(0.5);
  sprite.width = app.screen.height / 2;
  sprite.height = app.screen.height / 2;
  sprite.position.set(app.screen.width / 2, app.screen.height / 2);
  sprite.interactive = true;
  app.stage.addChild(sprite);
  updateBrush();

  const texture = PIXI.Texture.from('assets/play-button.png');
  var button = new PIXI.Sprite(texture);
  button.buttonMode = true;
  button.interactive = true;
  button.anchor.set(0.5);
  button.position.set(app.screen.width / 2, app.screen.height / 2);
  button.click = takePicture;
  app.stage.addChild(button);


  let drawingStarted = false;
  let lastPosition = null;

  const onDown = (e) => {
    const position = sprite.toLocal(e.data.global);
    position.x += 512;
    position.y += 512;

    lastPosition = position;
    drawingStarted = true;
  };

  const onMove = (e) => {
    const position = sprite.toLocal(e.data.global);
    position.x += 512;
    position.y += 512;

    if (drawingStarted) {
      drawPointLine(lastPosition, position);
    }

    lastPosition = position;
  };
  const onUp = (e) => {
    drawingStarted = false;
  };

  sprite.on('mousedown', onDown);
  sprite.on('touchstart', onDown);
  sprite.on('mousemove', onMove);
  sprite.on('touchmove', onMove);
  sprite.on('mouseup', onUp);
  sprite.on('touchend', onUp);

  app.ticker.add(() => {
    renderPoints();
  });

  gui
    .add(guiParams, 'brushSize', 1, 256)
    .name('Brush size')
    .onChange(() => updateBrush());
  gui
    .addColor(guiParams, 'brushColor')
    .name('Brush color')
    .onChange(() => updateBrush());
  gui
    .add(guiParams, 'brushSmoothing', 0.1, 1)
    .name('Brush smoothing')
    .onChange(() => updateBrush());
  gui
    .add(guiParams, 'useEraser')
    .name('Use eraser')
    .onChange(() => updateBrush());
}

function drawPoint(x, y) {
  const sprite = spritePool.get();
  sprite.x = x;
  sprite.y = y;
  sprite.texture = brushTexture;

  if (guiParams.useEraser) {
    sprite.filter = new PIXI.filters.AlphaFilter();
    sprite.blendMode = PIXI.BLEND_MODES.ERASE;
  } else {
    sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
  }

  drawBuffer.addChild(sprite);
}

function drawPointLine(oldPos, newPos) {
  const delta = {
    x: oldPos.x - newPos.x,
    y: oldPos.y - newPos.y,
  };
  const deltaLength = Math.sqrt(delta.x ** 2 + delta.y ** 2);

  drawPoint(newPos.x, newPos.y);

  if (deltaLength >= guiParams.brushSize / 8) {
    const additionalPoints = Math.ceil(deltaLength / (guiParams.brushSize / 8));

    for (let i = 1; i < additionalPoints; i++) {
      const pos = {
        x: newPos.x + delta.x * (i / additionalPoints),
        y: newPos.y + delta.y * (i / additionalPoints),
      };

      drawPoint(pos.x, pos.y);
    }
  }
}

function renderPoints() {
  app.renderer.render(drawBuffer, renderTexture, false);

  drawBuffer.children = [];
  spritePool.reset();
}

function updateBrush() {
  brushTexture = brushGenerator.get(
    guiParams.brushSize,
    guiParams.brushColor,
    guiParams.brushSmoothing,
    guiParams.useEraser
  );
}

const layers = new Map();

window.API = {
  createGraffitiLayer: ({layerId, color, size}) => {
    layers.set(layerId, {color, size, body: []});
  },
  pushGraffitiPoint: ({layerId, x, y}) => {
    const layer = layers.get(layerId);

    if (layer) {
      layer.body.push([x, y]);

      if (layer.body.length < 2) {
        return;
      }

      const prevState = {...guiParams};

      Object.assign(guiParams, {
        brushSize: layer.size,
        brushColor: layer.color,
        useEraser: layer.color === -1,
      });

      updateBrush();

      const prevPoint = layer.body[layer.body.length - 2];

      drawPointLine({x: prevPoint[0], y: prevPoint[1]}, {x, y});

      Object.assign(guiParams, prevState);

      updateBrush();
    }
  },
};
