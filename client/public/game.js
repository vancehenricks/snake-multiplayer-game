const DEFAULT_IDLE_SPEED = 5;
const CLIENT_TICK_MS = 50;
const ANIMATION_TICK_MS = 33;
const CHANNEL = '/game';
const TYPE = {
    PLAYER: 'player',
    FOOD: 'food',
    OBSTACLE: 'obstacle',
}

const STATUS = {
    ALIVE: 'alive',
    DEAD: 'dead'
}

const ENTITY_PROPERTIES = [
    'type',
    'id',
    'position',
    'name',
    'size',
    'score',
    'tail',
    'direction',
    'invulnerable',
    'timeout',
    'status',
    'nodes',
    'animation', //in client only
]

const CLOSE_VIOLATION = {
    INVALID_ROOMID_GIVEN: 4000,
    ENTITY_TIMEDOUT : 4001,
    INVALID_PLAYER_NAME_GIVEN: 4002,
    GAME_ALREADY_STARTED: 4003,
    GAME_TIMEDOUT: 4004
}

function establishConnection() {
    const roomId = getRoomId();
    const playerName = getPlayerName();
    connection = new WebSocket(`${ADDR}${CHANNEL}?roomId=${roomId}&playerName=${playerName}`)

    connection.onerror = error => {
        console.log(`WebSocket error:`, error)
    }

    connection.onopen = e => {
        console.log('Connected to server');
    }

    connection.onmessage = e => {
        console.log('Server says:', e.data)
    }

    connection.onclose = e => {
        console.log('Connection closed reason:', e.reason, " code:", e.code);
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
}

function sendPlayerDirectionToServer(entity) {
    sendToServer({ player: { id: entity.id, direction: entity.direction}})
}

function sendStartGameToServer() {
    sendToServer({startGame: true});
}

function sendReadyToServer() {
    isPlayerReady = !isPlayerReady;
    sendToServer({ready: isPlayerReady});
}

function createCanvas() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = 500;
    canvas.height = 500;
}

function updateScore() {
    document.getElementById('score').innerText = player.score;  
}

function createAnimationId(entityId, animationName) {
    return entityId + ',' + animationName;
}

function getEntityIdFromAnimationId(animationId) {
    return animationId.split(',')[0];
}

function renderObstacle({id, size, nodes}, isFill) {
    const animationId = createAnimationId(id, 'obstacle');
    const payload = getAnimationFramePayload(animationId);

    const {x, y} = payload || nodes[0];

    ctx.beginPath();
    ctx.fillStyle = '#f1f1f1';
    ctx.strokeStyle = '#242424';
    ctx.lineWidth = 2; 

    ctx.rect(x - size / 2, y - size / 2, size, size);
    ctx.fill();
    ctx.stroke();

    if (isFill) {
        const innerSize = size / 2;
        ctx.beginPath();
        ctx.fillStyle = '#242424';
        ctx.strokeStyle = '#f1f1f1';
        ctx.lineWidth = 2;
        ctx.rect(x - innerSize / 2, y - innerSize / 2, innerSize, innerSize);
        ctx.fill();
        ctx.stroke();
    }

    if(payload) {
        if(y > payload.refY-5 && y > payload.refY+5) {
            nextAnimationFrame(animationId, {x, y: y+payload.increment, ...payload});
        }
        else {
            nextAnimationFrame(animationId, {x, y: y-payload.increment, ...payload});
        }
    } else {
        const initial = Math.random() * 5;
        nextAnimationFrame(animationId, {x, y: y+initial, refY: y, increment : initial});
    }
}

function renderFood({id, size, nodes}) {
    const animationId = createAnimationId(id, 'spawn');
    const payload = getAnimationFramePayload(animationId);

    const {x, y} = payload || nodes[0];

    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#242424';
    ctx.arc(x, y, size/2, 0, Math.PI * 2, false);
    ctx.fillStyle = '#f1f1f1';
    ctx.stroke();
    ctx.fill();

    if(payload) {
        if(y > payload.refY-5 && y > payload.refY+5) {
            nextAnimationFrame(animationId, {x, y: y+payload.increment, ...payload});
        }
        else {
            nextAnimationFrame(animationId, {x, y: y-payload.increment, ...payload});
        }
    } else {
        const initial = Math.random() * 5;
        nextAnimationFrame(animationId, {x, y: y+initial, refY: y, increment : initial});
    }
}

function renderSnakeHead(entity) {
    const node = entity.nodes[0];
    const animationId = createAnimationId(entity.id, 'eat');
    const payload = getAnimationFramePayload(animationId);
    const isPlayer = isEntityPlayer(entity);

    const size = payload?.size || entity.size * 2;
    const {x, y} = {x: node.x - 3, y: node.y - 5}

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isPlayer ? '#66023c' : '#242424';
    ctx.lineCap = 'round';
    ctx.moveTo(node.x, node.y);

    const diagonalOffset = 7;
    const straightOffset = 10;

    if (entity.direction.y === -1 && entity.direction.x === 0) {
        ctx.lineTo(node.x, node.y+straightOffset);
    } else if (entity.direction.y === 1 && entity.direction.x === 0) {  
        ctx.lineTo(node.x, node.y-straightOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === 0) {
        ctx.lineTo(node.x+straightOffset, node.y);
    } else if (entity.direction.x === 1 && entity.direction.y === 0) {
        ctx.lineTo(node.x-straightOffset, node.y);
    } else if (entity.direction.x === 1 && entity.direction.y === 1) {
        ctx.lineTo(node.x-diagonalOffset, node.y-diagonalOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === 1) {
        ctx.lineTo(node.x+diagonalOffset, node.y-diagonalOffset);
    } else if (entity.direction.x === 1 && entity.direction.y === -1) {
        ctx.lineTo(node.x-diagonalOffset, node.y+diagonalOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === -1) {
        ctx.lineTo(node.x+diagonalOffset, node.y+diagonalOffset);
    }
    
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = isPlayer ? '#66023c' : '#242424';
    ctx.arc(x + 3, y + 5, size/3, 0, Math.PI * 2, false);
    ctx.fillStyle = '#f1f1f1';
    ctx.stroke();
    ctx.fill();

    if(payload) {
        if (entity.animation.eat) {
            nextAnimationFrame(animationId, { ...payload, eat: payload.eat+1});
        }
        if(payload.eat > 0) {
            if(size < payload.expected && !payload.exit) {
                nextAnimationFrame(animationId, {...payload, size: size+3});
            } else {
                if (size > payload.initial) {
                    nextAnimationFrame(animationId, {...payload, size : size-3, exit: true});
                } else {
                    nextAnimationFrame(animationId, {...payload, size: payload.initial, eat: payload.eat-1, exit: false});
                }
            }
        }
    } else if (entity.animation.eat) {
        nextAnimationFrame(animationId, {size: size, initial: size, expected: size+6, eat: 1, exit: false});
    }
}


function renderLabel({ direction, node, value}) {
    const { x, y } = node;
    const { y: dy } = direction;

    ctx.fillStyle = '#242424';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    if (dy === -1) {
        ctx.fillText(value, x, y + 28);   
    } else {
        ctx.fillText(value, x, y - 22);
    }
}

function renderName(entity) {
    renderLabel({direction: entity.direction, node: entity.nodes[0], value: entity.name});
}

function renderInvulnerableTimeLeftLabel(entity) {
    const secondsLeft = convertToSeconds(getRemainingTime(entity.invulnerable));

    if (secondsLeft < 10 && secondsLeft > 0) {
        renderLabel({direction: entity.direction, node: entity.nodes[0], value: secondsLeft});
    }
}

function renderSnake(entity) {
    const isPlayer = isEntityPlayer(entity);

    ctx.beginPath();
    ctx.lineWidth = entity.size;
    ctx.strokeStyle = isPlayer ? '#66023c' : '#242424';
    ctx.lineCap = 'round';

    entity.nodes.forEach((node, index) => {
        if (index === 0) {
            ctx.moveTo(node.x, node.y);
        } else {
            ctx.lineTo(node.x, node.y);
        }
    });

    ctx.stroke();

    const nodesLeft = entity.nodes.slice(-1);
    nodesLeft.forEach((node) => {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isPlayer ? '#66023c' : '#242424';
        ctx.arc(node.x, node.y, entity.size / 2, 0, Math.PI * 2, false);
        ctx.fillStyle = '#f1f1f1';
        ctx.fill();
        ctx.stroke();
    });
}


function renderPlayer() {
    renderSnake(player);;
    renderSnakeHead(player);
    renderInvulnerableEffect(player);
    renderInvulnerableTimeLeftLabel(player);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function renderInvulnerableEffect(entity) {
    const payload = getAnimationFramePayload(entity.id);
    const {nodes, size} = entity;
    const {x, y} = nodes[0];
    const isPlayer = isEntityPlayer(entity);

    if(isInvulnerableTimedOut(entity)) return;

    const endAngle = payload?.value || 0;

    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = isPlayer ? '#66023c' : '#242424';
    ctx.arc(x, y, size+endAngle, 5-endAngle, endAngle, false);
    ctx.stroke();


    if(payload) {
        if (endAngle <= payload.expected) {
        nextAnimationFrame(entity.id, {...payload, value: endAngle+0.5});
        } else {
            nextAnimationFrame(entity.id, {...payload, value: 0, expected: Math.PI*2});
        }
    } else {
        nextAnimationFrame(entity.id, { intial: 0, value: 0, expected: Math.PI*2});
    }
}

function createDiagonalPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 10;
    patternCanvas.height = 10;
    const patternCtx = patternCanvas.getContext('2d');

    patternCtx.strokeStyle = '#d3d3d3';
    patternCtx.lineWidth = 1;
    patternCtx.beginPath();
    patternCtx.moveTo(0, 0);
    patternCtx.lineTo(10, 10);
    patternCtx.stroke();

    return ctx.createPattern(patternCanvas, 'repeat');
}

function renderSpawnArea() {
    const squareSize = 50;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;



    const pattern = createDiagonalPattern();

    ctx.beginPath();
    ctx.strokeStyle = '#d3d3d3';
    ctx.fillStyle = pattern;
    ctx.lineWidth = 1;
    ctx.rect(centerX - squareSize / 2, centerY - squareSize / 2, squareSize, squareSize);
    ctx.fill();
    ctx.stroke();
}

function renderEntities() {
    clearCanvas();
    renderSpawnArea();
    [...gameEntities].forEach((entity) => {
        if(entity.id === player.id) return;
        if(entity.type === TYPE.FOOD) {
            renderFood(entity);
            return;
        }
        if(entity.type === TYPE.OBSTACLE) {
            renderObstacle(entity, isInvulnerableTimedOut(player));
            return;
        }

        renderSnake(entity);
        renderSnakeHead(entity);
        renderName(entity);
        renderInvulnerableEffect(entity);
    });

    renderPlayer();
}

function convert1DArrayToNodes (array) {
    let nodes = [];
    for (let i = 0; i < array.length; i += 2) {
        nodes.push({x: array[i], y: array[i+1]});
    }
    return nodes;
}

function getPlayer(entities, playerId = player.id) {
    return [...entities].find((entity) => entity.id === playerId) || player;
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

    if(direction.x === previousDirection.x && direction.y === previousDirection.y ||
        previousDirection.x === -direction.x && previousDirection.y === -direction.y
    )
        return

    if (direction.x !== 0 || direction.y !== 0) {
        player = updateDirection({entity: player, direction});
        sendPlayerDirectionToServer(player);
        previousDirection = direction;
    }
}

function displayGameOver() {
    stopGameLoop();
    gameOver();
}

function displayWinner() {
    displayGameOver();
    winner(scoreBoard[0].name);
}

function isInvulnerableTimedOut(entity) {
    const { timeout, maxMs } = entity.invulnerable;
    if (Date.now() - timeout > maxMs) {
        return true;
    }
    return false;
}

function convertToSeconds(ms) {
    return Math.floor(ms / 1000);
}

function convertToMinutes(ms) {
    return Math.floor(ms / 60);
}

function getRemainingTime({ timeout, maxMs }) {
    return  maxMs - (Date.now() - timeout);
}

function convertToCountdown({ timeout, maxMs }) {
    const remainingMs = maxMs - (Date.now() - timeout);
    const remainingSeconds = convertToSeconds(remainingMs);
    const remainingMinutes = convertToMinutes(remainingSeconds);

    if (remainingMinutes > 0) {
        const seconds = remainingSeconds % 60;
        return `${remainingMinutes}m ${seconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

function updateVulnerableEffect() {
    const invulnerableTimeleft = convertToCountdown(player.invulnerable);

    if(!isInvulnerableTimedOut(player)) {
        document.getElementById('invulnerable').innerText = '🛡️ Shield: ' + invulnerableTimeleft;
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
    scoreBoard.forEach((scoreEntry, index) => {
        if (index === 0) {
            addCellToTable(column, '👑 ' + scoreEntry.name + ': ' + scoreEntry.score);
            return;
        }
        addCellToTable(column, scoreEntry.name + ': ' + scoreEntry.score);
    });
    scoreBoardTable.appendChild(column);
}

function isInReadyList(entity) {
    return readyList.includes(entity.id);
}

function isEntityPlayer(entity) {
    return entity.id === player.id;
}

function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    const column = document.createElement('ol');
    [...gameEntities].filter((entity) => entity.type === TYPE.PLAYER).forEach((entity) => {
        
        const isEntityCreator = isCreator(entity.id);
        let label = isEntityCreator ? '(Host)' : '';

        if (!isEntityCreator) {
            label = isInReadyList(entity) ? '✅' : '❌';
        }

        if (isEntityPlayer(entity)) {
            label = isPlayerReady ? '(You)✅' : '(You)❌';
        }
        
        addCellToTable(column, entity.name + label);
    });
    playerList.appendChild(column);
}

function getPlayerName() {
    return document.getElementById('playerNameInput').value;
}

function getRoomId() {
    return document.getElementById('roomIdInput').value;
}


function cleanupStaleAnimations() {
    gameAnimation = [...gameAnimation].filter((animation) => {
        return [...gameEntities].find((entity) => entity.id === getEntityIdFromAnimationId(animation.id));
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

function updateEntityFromMap(entity) {
    gameEntities = [...gameEntities].map(gameEntity => {
        if(gameEntity.id === entity.id) {
           return { ...gameEntity, ...entity };
        }
        return gameEntity;
    });
}

function updateNodePositions (entity) {
    for (let i = entity.nodes.length - 1; i > 0; i--) {
        entity.nodes[i] = entity.nodes[i-1];
    }
    return entity;
}

function addNodeToEntity(entity) { 
    let newEntity = {...entity};
    const lastNode = newEntity.nodes[newEntity.nodes.length - 1];

    if(newEntity.tail.current < newEntity.tail.max) {
        newEntity.nodes = [...newEntity.nodes, lastNode];
        newEntity.tail.current += 1;
    }
    return newEntity;
}

function movePlayerEntities() {
    [...gameEntities].forEach((entity) => {
        if(entity.type === TYPE.PLAYER) {
            const {x, y} = entity.nodes[0];
            const {x: dx, y: dy} = entity.direction;
            
            let speed = DEFAULT_IDLE_SPEED+1.3;

            if(Math.abs(dx) > 0 && Math.abs(dy) > 0) {
                speed = DEFAULT_IDLE_SPEED;
            }

            const newNode = createNode({x: x - dx * speed, 
                y: y - dy * speed});

            const newEntity = {
                ...entity,
                nodes: [newNode, ...entity.nodes.slice(1)]
            };

            
            let updatedNodes = addNodeToEntity(newEntity);
            updatedNodes = updateNodePositions(updatedNodes);
            updateEntityFromMap(updatedNodes);

            if(player.id === updatedNodes.id) {
                player = updatedNodes;
            }
        }
    });
}

function hasCompleteProperties(entity) {
    let hits = 0;
    ENTITY_PROPERTIES.forEach(property => {
        Object.keys(entity).forEach(key => {
            if(property === key) hits += 1;
        })
    });

    return hits === ENTITY_PROPERTIES.length-1;
}

function updateTail(entity, gameEntity) {
    if(gameEntity?.tail?.current) {
        return {
            ...entity,
            tail: {
                ...entity.tail,
                current: gameEntity.tail.current,
            }
        }
    }

    return entity;
}

function addAnimationIndicatorsToEntity(entity) {

    const gameEntity = gameEntities?.find((gEntity) => entity.id === gEntity.id);

    if(!gameEntity) {
        return {
            ...entity,
            animation: {
                eat: false,
            }
        }
    };

    return {
        ...entity,
        animation: {
            eat: entity.score > gameEntity.score,
        }
    }
}

function addAnimationIndicatorsToEntities(entities) {
    return [...entities].map(entity => addAnimationIndicatorsToEntity(entity));
}

function updateEntities(entities) {
    if (gameEntities.length === 0) return entities;

    const updatedEntities = entities.map(entity => {
        const gameEntity = [...gameEntities].find((gEntity) => 
            entity.id === gEntity.id
        )

        let updatedEntity = updateTail(entity, gameEntity);

        return {...gameEntity, ...updatedEntity};

    }).filter(entity => hasCompleteProperties(entity))

    const removedDuplicates = [...gameEntities].filter(gameEntity => 
        !updatedEntities.some(entity => gameEntity.id === entity.id)
    )

    return [...updatedEntities, ...removedDuplicates]

}

function removeDeadEntities() {
    gameEntities = [...gameEntities].filter(gameEntity => gameEntity.status === STATUS.ALIVE)
}

function updateGameTime() {
    if (gameTime === null) return;
    document.getElementById('timeLeftValue').innerText = convertToCountdown(gameTime);
}

function updateGame() {
    if (!startGameUpdate) {
        updatePlayerList();
        removeDeadEntities();
        return;
    };
    
    updateScore();
    updateScoreBoard();
    playerControl();
    renderEntities();
    movePlayerEntities();
    updateVulnerableEffect();
    updateGameTime();
    removeDeadEntities();
}

function isCreator(id = player.id) {

    if (creatorId === id) {
        console.log(creatorId, id);

    }
    return creatorId === id;
}

function startGameLoop () {
    if (isCreator()) {
        sendStartGameToServer();
    }
    startGameUpdate = true;
}

function stopGameLoop () {
    startGameUpdate = false;
}

function convertEntities1DArrayToNodes(entities) {
    
    return [...entities].map(entity => {

        if (entity.nodes) {
            return {
                ...entity,
                nodes: convert1DArrayToNodes(entity.nodes),
            }
        }

        return entity;
    });
}

function readyListMatchesCurrentPlayers() {
    const players = [...gameEntities].filter(entity => entity.type === TYPE.PLAYER);
    return players.length === readyList.length;
}


establishConnection();
createCanvas();
let ctx = canvas.getContext('2d');
let player = {};
let gameEntities = [];
let previousDirection = [];
let gameAnimation = [];
let scoreBoard = [];
let keys = {};
let startGameUpdate = false;
let gameTime = null;
let creatorId = null;
let readyList = [];
let isPlayerReady = false;

connection.onclose = ({code}) => {
    if(code === CLOSE_VIOLATION.GAME_ALREADY_STARTED) {
        alert('Game already started');
        returnToMenu();
    }
    else if (code === CLOSE_VIOLATION.ENTITY_TIMEDOUT) {
        displayGameOver();
    }
    else if (code === CLOSE_VIOLATION.GAME_TIMEDOUT) {
        displayWinner();
    }
}

connection.onmessage = ({data}) => {
    try {
        const {playerId, 
            entities, 
            scoreBoard: sb, 
            creatorId: ci,
            readyList: rl, 
            gameTime: gt,
            gameStarted,
        } = JSON.parse(data);


        if (rl) {
            readyList = rl;
            if(readyListMatchesCurrentPlayers() && isCreator()) {
                showStartGameButton();
            } else {
                hideStartGameButton();
            }
        }
        
        if (sb) {
            scoreBoard = sb;
        }

        if (ci) {
            creatorId = ci;
            if(!isCreator(playerId)) {
                showReadyButton();
            }
        }

        if(gt) {
            gameTime = gt;
        }

        if(gameStarted) {
            startGame();
        }
        
        
        if (entities) {
            let convertedEntities = convertEntities1DArrayToNodes(entities);
                convertedEntities = addAnimationIndicatorsToEntities(convertedEntities);
            if (playerId) {
                player = getPlayer(convertedEntities, playerId);
                gameEntities = convertedEntities;
            } else {
                convertedEntities = updateEntities(convertedEntities);
                player = getPlayer(convertedEntities);
                gameEntities = convertedEntities;
            }

        }
        
    } catch (err) {
        console.error(err);
    };
}

document.addEventListener('keydown', function(event) {
    keys[event.key] = true;
});

document.addEventListener('keyup', function(event) {
    keys[event.key] = false;
});

setTimeout(function run() {
    cleanupStaleAnimations();
    setTimeout(run, ANIMATION_TICK_MS);
}, ANIMATION_TICK_MS);

setTimeout(function run() {
    updateGame();
    setTimeout(run, CLIENT_TICK_MS);
}, CLIENT_TICK_MS);
