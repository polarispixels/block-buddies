// JUNKYARD BLOCK BASH art pack — pure drawing, no game-state reads.
const BASH_ART = {
  arcadeDoor(ctx, cx, g, t, o = {}) { // placeholder — Task 3 draws the real cabinet
    ctx.fillStyle = '#4a4a5a'; ctx.fillRect(cx - 46, g - 118, 92, 118);
    drawFace(ctx, cx, g - 70, 40, 'happy', t, 7);
  }
};
