function establishConnection() {
    const server = 'ws://82.197.93.188:7541'
    const channel = '/game';

    const url = new URL(channel, server).toString()
    connection = new WebSocket(url)

    connection.onerror = error => {
        console.log(`WebSocket error: ${error}`)
}

    connection.onopen = e => {
        console.log('Connected to server');
    }

    connection.onmessage = e => {
        console.log('Server says:', e.data)
    }

    connection.onclose = () => {
        console.log('Connection closed');
    }
}

function sendToServer(message) {
    if (!connection) {
        console.error('You have to call establishConnection() first');
        return;
    }
    let msg = message;
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    connection.send(msg);
    //console.info('Sending message to server');
}

function sendPongToServer() {
    if (!connection) {
        console.error('You have to call establishConnection() first');
        return;
        }
        connection.send(JSON.stringify({ type: 'pong', player }));
        //console.info('Sending pong to server');
    }

function createCanvas() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = 500;
    canvas.height = 500;
}

function updateScore() {
    //console.log(player);
    document.getElementById('score').innerText = player.score;  
}

function renderFood({id, size, nodes}) {
    const payload = getAnimationFramePayload(id);

    const {x, y} = payload || nodes[0];

    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#242424';
    ctx.arc(x, y, size/3, 0, Math.PI * 2, false);
    ctx.fillStyle = '#f1f1f1';
    ctx.stroke();
    ctx.fill();

    if(payload) {
        if(y > payload.refY-5 && y > payload.refY+5) {
            nextAnimationFrame(id, {x, y: y+payload.increment, ...payload});
        }
        else {
            nextAnimationFrame(id, {x, y: y-payload.increment, ...payload});
        }
    } else {
        const initial = Math.random() * 5;
        nextAnimationFrame(id, {x, y: y+initial, refY: y, increment : initial});
    }
}

function renderPlayerHighlight({x, y, size, color}) {
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.arc(x + 3, y + 5, size/3, 0, Math.PI * 2, false);
    ctx.fillStyle = '#f1f1f1';
    ctx.stroke();
    ctx.fill();
}

function renderSnake(entity) {
    ctx.beginPath();
    entity.nodes.forEach((node, index) => {
        if(index === 0) {
            ctx.lineWidth = entity.size * 2;
            ctx.strokeStyle = entity.color;
            ctx.lineCap = 'round';
            ctx.lineTo(node.x, node.y);
            ctx.stroke();
            ctx.beginPath();
        } else if (index > entity.nodes.length-3) {
            ctx.stroke();
            ctx.beginPath();
            ctx.lineWidth = entity.size - 0.5;
            ctx.strokeStyle = entity.color;
            ctx.lineCap = 'round';
            ctx.lineTo(node.x, node.y);
            ctx.stroke();
            ctx.beginPath();
        }
        else {
            ctx.lineWidth = entity.size;
            ctx.strokeStyle = entity.color;
            ctx.lineCap = 'round';
            ctx.lineTo(node.x, node.y);
        }
    });
    ctx.stroke();
}


function renderPlayer() {
    renderSnake(player);
    const node = player.nodes[0];

    const size = player.size * 2;
    const {x, y} = {x: node.x - 3, y: node.y - 5}
    
    renderPlayerHighlight({...player, x, y, size});
    renderInvulnerableEffect(player);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

const TYPE = {
    PLAYER: 'player',
    FOOD: 'food'
}

const STATUS = {
    ALIVE: 'alive',
    DEAD: 'dead'
}

function renderInvulnerableEffect(entity) {
    const {nodes, size, color} = entity;
    const {x, y} = nodes[0];
    
    if(isInvulnerableTimedOut(entity)) return;

    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.arc(x, y, size*1.5, 0, Math.PI * 2, false);
    ctx.stroke();
}

function renderEntities() {
    clearCanvas();
    gameEntities.forEach((entity) => {
        if(entity.id === player.id) return;
        if(entity.type === TYPE.FOOD) {
            renderFood(entity);
            return;
        }
        renderSnake(entity);
        renderInvulnerableEffect(entity);
    });

    renderPlayer();}

function getPlayer(entitles) {
    return entitles.find((entity) => entity.id === player.id);
}

function createNode ({x, y}) {
    return {
        x,
        y,
    }
}

function updateDirection({entity, direction}) {
    entity.direction = direction;
    return entity;
}

function playerControl() {
    const keyDirectionMap = {
        'w': {x: 0, y: 1},
        'ArrowUp': {x: 0, y: 1},
        's': {x: 0, y: -1},
        'ArrowDown': {x: 0, y: -1},
        'a': {x: 1, y: 0},
        'ArrowLeft': {x: 1, y: 0},
        'd': {x: -1, y: 0},
        'ArrowRight': {x: -1, y: 0},
    };
    
    let direction = {x: 0, y: 0};
    
    for (let key in keys) {
        let lowerKey = key;
        if (key.length === 1) {
            lowerKey = key.toLowerCase();
        }
        if (keys[key] && keyDirectionMap[lowerKey]) {
            direction.x += keyDirectionMap[lowerKey].x;
            direction.y += keyDirectionMap[lowerKey].y;
        }
    }

    if(direction.x === player.direction.x && direction.y === player.direction.y ||
       player.direction.x === -direction.x && player.direction.y === -direction.y
    )
        return

    if (direction.x !== 0 || direction.y !== 0) {
        player = updateDirection({entity: player, direction});
        sendToServer({player});
    }
}

function displayGameOver() {
    if (player.status === STATUS.DEAD) {
        clearInterval(tickInterval);
        clearInterval(animationInterval);
        //console.log('Game over');
        gameOver();
    }
}

function isInvulnerableTimedOut(entity) {
    const { timeout, maxMs } = entity.invulnerable;
    if (Date.now() - timeout > maxMs) {
        return true;
    }
    return false;
}

function ConvertToSeconds(ms) {
    return Math.floor(ms * .001);
}

function ConvertToCountdown({timeout, maxMs}) {
    return ConvertToSeconds(maxMs - (Date.now() - timeout));
}

function displayVulnerableEffect() {
    const invulnerableTimeleftSeconds = ConvertToCountdown(player.invulnerable);

    if(!isInvulnerableTimedOut(player)) {
        document.getElementById('invulnerable').innerText = 'invulnerable: ' + invulnerableTimeleftSeconds + 's';
    } else {
        document.getElementById('invulnerable').innerText = '';
    }
}

function addCellToTable(table, value) {
    const column = document.createElement('li');
    column.innerText = value;
    table.appendChild(column);
}


function updateScoreBoard() {
    const scoreBoardTable = document.getElementById('scoreBoard');
    scoreBoardTable.innerHTML = '';
    const column = document.createElement('ol');
    scoreBoard.forEach((scoreEntry) => {
        addCellToTable(column, scoreEntry.name + ': ' + scoreEntry.score);
    });
    scoreBoardTable.appendChild(column);
}

function getPlayerName() {
    return document.getElementById('playerNameInput').value;
}

function cleanupStaleAnimations() {
    gameAnimation = [...gameAnimation].filter((animation) => {
        return [...gameEntities].find((entity) => entity.id === animation.id);
    });
}

function removeAnimation(id) {
    return [...gameAnimation].filter((animation) => animation.id !== id);
}

function nextAnimationFrame(id, payload) {
    const removeExistingAnimation = removeAnimation(id);
    gameAnimation = [...removeExistingAnimation, createAnimationFrame({id, payload})];
}

function getAnimationFramePayload(id) {
    return gameAnimation.find((animation) => animation.id === id)?.payload;
}

function createAnimationFrame({id, payload}) {
    return {id, payload};
}

establishConnection();
createCanvas();
let ctx = canvas.getContext('2d');
let player = {};
let gameEntities = [];
let gameAnimation = [];
let scoreBoard = [];
let keys = {};

connection.onmessage = ({data}) => {
const {isPlayer, entities, type, scoreBoard: sb} = JSON.parse(data);
//console.log('Server says:', {entities, isPlayer, type})

    if (type === 'ping') {
        //console.log('Ping received from server');
        sendPongToServer();
        return;
    }
    if (type === 'scoreBoard') {
        //console.log('Scoreboard received from server');
        scoreBoard = sb;
        return;
    }

    if (isPlayer) {
        player =  {...entities[0], name: getPlayerName()};
        sendToServer({player});
    } else {
        player = getPlayer(entities) || player;
        gameEntities = entities;
    }
}

document.addEventListener('keydown', function(event) {
    keys[event.key] = true;
});

document.addEventListener('keyup', function(event) {
    keys[event.key] = false;
});


const CLIENT_TICK_MS = 100;
const ANIMATION_TICK_MS = 10;

const animationInterval = setInterval(() => {
    cleanupStaleAnimations();
}, ANIMATION_TICK_MS);

const tickInterval = setInterval(() => {
    playerControl();
    updateScore();
    renderEntities();
    displayGameOver();
    updateScoreBoard();
    displayVulnerableEffect();
}, CLIENT_TICK_MS);
