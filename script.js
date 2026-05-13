const IMG_SOURCES = {
  w: { k: 'img/w_k.png', q: 'img/w_q.png', r: 'img/w_r.png', b: 'img/w_b.png', n: 'img/w_n.png', p: 'img/w_p.png' },
  b: { k: 'img/b_k.png', q: 'img/b_q.png', r: 'img/b_r.png', b: 'img/b_b.png', n: 'img/b_n.png', p: 'img/b_p.png' }
};

const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

// --- SONS ---
const winSound = new Audio('sound/xeque-mate.mp3');
function playMoveSound() {
  const rand = Math.floor(Math.random() * 6) + 1;
  new Audio(`sound/move${rand}.mp3`).play().catch(() => {});
}
function playWinSound() {
  winSound.currentTime = 0;
  winSound.play().catch(() => {});
}

// --- ESTADO DO JOGO ---
let board = []; let turn = 'w'; let selected = null; let legalMoves = [];
let difficulty = 3; 
let movedStatus = { wK:false, wR1:false, wR8:false, bK:false, bR1:false, bR8:false };
let isPromoting = false; let gameOver = false;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const promoMenu = document.getElementById('promo-menu');

function initBoard() {
  board = Array.from({length:8},()=>Array(8).fill(null));
  const back = ['r','n','b','q','k','b','n','r'];
  for(let i=0; i<8; i++){
    board[0][i]={type:back[i], color:'b'}; board[1][i]={type:'p', color:'b'};
    board[6][i]={type:'p', color:'w'}; board[7][i]={type:back[i], color:'w'};
  }
  turn = 'w'; selected = null; legalMoves = []; isPromoting = false; gameOver = false;
  movedStatus = { wK:false, wR1:false, wR8:false, bK:false, bR1:false, bR8:false };
  if(promoMenu) promoMenu.style.display = 'none';
  render();
}

function render() {
  boardEl.innerHTML = '';
  for(let r=0; r<8; r++) {
    for(let c=0; c<8; c++) {
      const isDark = (r + c) % 2;
      const sq = document.createElement('div');
      sq.className = `square ${isDark ? 'dark' : 'light'}`;
      
      const labelColor = isDark ? "var(--light)" : "var(--dark)";
      if (c === 0) {
        const ln = document.createElement('span');
        ln.style = `position:absolute; top:2px; left:4px; font-size:10px; font-weight:800; color:${labelColor}; opacity:0.6; pointer-events:none;`;
        ln.textContent = 8 - r;
        sq.appendChild(ln);
      }
      if (r === 7) {
        const ll = document.createElement('span');
        ll.style = `position:absolute; bottom:2px; right:4px; font-size:10px; font-weight:800; color:${labelColor}; opacity:0.6; pointer-events:none;`;
        ll.textContent = String.fromCharCode(97 + c);
        sq.appendChild(ll);
      }

      const piece = board[r][c];
      if(piece) {
        const div = document.createElement('div');
        div.className = 'piece';
        const img = document.createElement('img');
        img.src = IMG_SOURCES[piece.color][piece.type];
        div.appendChild(img);
        sq.appendChild(div);
      }
      const move = legalMoves.find(m => m.r === r && m.c === c);
      if(move) sq.classList.add(piece ? 'hl-capture' : 'hl-move');
      sq.onclick = () => onSquareClick(r, c);
      boardEl.appendChild(sq);
    }
  }
  if (!gameOver) {
    statusEl.textContent = turn === 'w' ? "Sua vez" : (difficulty === 0 ? "Vez das Pretas" : "IA pensando...");
  }
}

function onSquareClick(r, c) {
  if (isPromoting || gameOver) return;
  const p = board[r][c];
  if(selected) {
    const move = legalMoves.find(m => m.r === r && m.c === c);
    if(move) { executeMove(board, selected.r, selected.c, r, c, move.special); return; }
  }
  if(p && p.color === turn) {
    selected = {r, c};
    legalMoves = computeLegalMoves(r, c, board);
    render();
  } else { selected = null; legalMoves = []; render(); }
}

function executeMove(targetBoard, r1, c1, r2, c2, special) {
  const p = targetBoard[r1][c1];

  // --- LÓGICA DE MEMÓRIA DO ROQUE ---
  if(p.type === 'k') movedStatus[p.color+'K'] = true;
  if(p.type === 'r') {
    if(c1 === 0) movedStatus[p.color+'R1'] = true; // Torre da esquerda
    if(c1 === 7) movedStatus[p.color+'R8'] = true; // Torre da direita
  }

  if(special === 'castle') {
    const rookC = c2 === 6 ? 7 : 0;
    const rookDestC = c2 === 6 ? 5 : 3;
    targetBoard[r2][rookDestC] = targetBoard[r2][rookC];
    targetBoard[r2][rookC] = null;
  }

  targetBoard[r2][c2] = p;
  targetBoard[r1][c1] = null;

  if(targetBoard === board) {
    playMoveSound();
    if(p.type === 'p' && (r2 === 0 || r2 === 7)) {
        showPromotionMenu(r2, c2, p.color);
    } else {
        finalizeTurn();
    }
  } else {
    if(p.type === 'p' && (r2 === 0 || r2 === 7)) targetBoard[r2][c2].type = 'q';
  }
}

function finalizeTurn() {
  turn = turn === 'w' ? 'b' : 'w';
  selected = null; legalMoves = [];
  
  const allMoves = getAllMoves(board, turn);
  if (allMoves.length === 0) {
    gameOver = true;
    if (isCheck(board, turn)) {
      playWinSound();
      statusEl.textContent = "XEQUE-MATE!";
    } else {
      statusEl.textContent = "EMPATE!";
    }
  }
  render();
  if(!gameOver && turn === 'b' && difficulty > 0) setTimeout(aiThink, 500);
}

// --- INTELIGÊNCIA ARTIFICIAL ---
function aiThink() {
  const moves = getAllMoves(board, 'b');
  if (moves.length === 0) return;
  
  let bestMove = null;
  if(difficulty === 1) {
    bestMove = moves[Math.floor(Math.random() * moves.length)];
  } else {
    let bestScore = -Infinity;
    const depth = difficulty === 2 ? 2 : 3;
    moves.forEach(m => {
      const temp = board.map(row => row.map(cell => cell ? {...cell} : null));
      executeMove(temp, m.f.r, m.f.c, m.t.r, m.t.c, m.t.special);
      let score = minimax(temp, depth - 1, false, -Infinity, Infinity);
      if(score > bestScore) { bestScore = score; bestMove = m; }
    });
  }
  if(bestMove) executeMove(board, bestMove.f.r, bestMove.f.c, bestMove.t.r, bestMove.t.c, bestMove.t.special);
}

function minimax(b, depth, isMax, alpha, beta) {
  if(depth === 0) return evaluateBoard(b);
  const moves = getAllMoves(b, isMax ? 'b' : 'w');
  
  if (moves.length === 0) {
    if (isCheck(b, isMax ? 'b' : 'w')) {
      // Valoramos o mate mais rápido com o bônus de depth
      return isMax ? -10000 - depth : 10000 + depth;
    }
    return 0;
  }

  if(isMax) {
    let maxEval = -Infinity;
    for(const m of moves) {
      const snap = b.map(row => row.map(cell => cell ? {...cell} : null));
      executeMove(snap, m.f.r, m.f.c, m.t.r, m.t.c, m.t.special);
      const ev = minimax(snap, depth - 1, false, alpha, beta);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if(beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for(const m of moves) {
      const snap = b.map(row => row.map(cell => cell ? {...cell} : null));
      executeMove(snap, m.f.r, m.f.c, m.t.r, m.t.c, m.t.special);
      const ev = minimax(snap, depth - 1, true, alpha, beta);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if(beta <= alpha) break;
    }
    return minEval;
  }
}

function evaluateBoard(b) {
  let score = 0;
  for(let r=0; r<8; r++) {
    for(let c=0; c<8; c++) {
      if(b[r][c]) {
        const val = PIECE_VALUES[b[r][c].type];
        score += (b[r][c].color === 'b' ? val : -val);
      }
    }
  }
  return score;
}

function getAllMoves(b, color) {
  const moves = [];
  for(let r=0; r<8; r++) {
    for(let c=0; c<8; c++) {
      if(b[r][c]?.color === color) {
        computeLegalMoves(r, c, b).forEach(m => moves.push({f:{r,c}, t:m}));
      }
    }
  }
  return moves;
}

function computeLegalMoves(r, c, b, checkKing = true) {
  const p = b[r][c]; if(!p) return [];
  let moves = [];
  const inB = (rr,cc) => rr>=0 && rr<8 && cc>=0 && cc<8;
  const dir = p.color==='w' ? -1 : 1;

  if(p.type==='p'){
    if(inB(r+dir,c) && !b[r+dir][c]) {
        moves.push({r:r+dir,c});
        if(r===(p.color==='w'?6:1) && !b[r+2*dir][c]) moves.push({r:r+2*dir,c});
    }
    for(let dc of [-1,1]) if(inB(r+dir,c+dc) && b[r+dir][c+dc] && b[r+dir][c+dc].color!==p.color) moves.push({r:r+dir,c:c+dc});
  } else {
    const vectors = {
      n: [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
      b: [[1,1],[1,-1],[-1,1],[-1,-1]], r: [[1,0],[-1,0],[0,1],[0,-1]],
      q: [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],
      k: [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
    };
    vectors[p.type].forEach(d => {
      let nr=r+d[0], nc=c+d[1];
      while(inB(nr,nc)) {
        if(!b[nr][nc]) moves.push({r:nr, c:nc});
        else { if(b[nr][nc].color !== p.color) moves.push({r:nr, c:nc}); break; }
        if(p.type==='n'||p.type==='k') break;
        nr+=d[0]; nc+=d[1];
      }
    });
  }
  if(p.type === 'k' && checkKing) {
    const row = p.color === 'w' ? 7 : 0;
    if(!movedStatus[p.color+'K'] && !isCheck(b, p.color)) {
      if(!movedStatus[p.color+'R8'] && !b[row][5] && !b[row][6]) moves.push({r:row, c:6, special:'castle'});
      if(!movedStatus[p.color+'R1'] && !b[row][1] && !b[row][2] && !b[row][3]) moves.push({r:row, c:2, special:'castle'});
    }
  }
  if(checkKing) return moves.filter(m => {
      const snap = b.map(row => row.map(c => c ? {...c} : null));
      executeMove(snap, r, c, m.r, m.c, m.special);
      return !isCheck(snap, p.color);
  });
  return moves;
}

function isCheck(b, color) {
  let kr, kc;
  for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(b[r][c]?.type==='k' && b[r][c]?.color===color) { kr=r; kc=c; }
  const opp = color === 'w' ? 'b' : 'w';
  for(let r=0; r<8; r++) for(let c=0; c<8; c++) {
    if(b[r][c]?.color === opp && computeLegalMoves(r, c, b, false).some(m => m.r === kr && m.c === kc)) return true;
  }
  return false;
}

function showPromotionMenu(r, c, color) {
  isPromoting = true;
  promoMenu.style.display = 'flex';
  promoMenu.innerHTML = '';
  ['q', 'r', 'b', 'n'].forEach(type => {
    const opt = document.createElement('div');
    opt.className = 'promo-option';
    opt.innerHTML = `<img src="${IMG_SOURCES[color][type]}">`;
    opt.onclick = () => {
      board[r][c].type = type;
      promoMenu.style.display = 'none';
      isPromoting = false;
      finalizeTurn();
    };
    promoMenu.appendChild(opt);
  });
}

document.getElementById('toggleMode').onclick = function() {
  difficulty = (difficulty + 1) % 4;
  const labels = ["2 Jogadores", "IA Iniciante", "IA Intermediária", "IA Mestre"];
  this.textContent = "Nível: " + labels[difficulty];
  initBoard();
};

document.getElementById('reset').onclick = initBoard;
initBoard();