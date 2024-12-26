const DEFAULT_IDLE_SPEED = 5;
const CLIENT_TICK_MS = 100;
const ANIMATION_TICK_MS = 10;
const CHANNEL = '/game';
const TYPE = {
    PLAYER: 'player',
    FOOD: 'food'
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
    'color',
    'size',
    'score',
    'tail',
    'direction',
    'invulnerable',
    'timeout',
    'status',
    'nodes',
]

const CLOSE_VIOLATION = {
    INVALID_ROOMID_GIVEN: 4000,
    ENTITY_TIMEDOUT : 4001,
    INVALID_PLAYER_NAME_GIVEN: 4002,
    GAME_ALREADY_STARTED: 4003
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

        if(e.code === CLOSE_VIOLATION.GAME_ALREADY_STARTED) {
            alert('Game already started');
            window.location.reload();
        }
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

function renderSnakeHead({entity, isFill=false}) {
    const node = entity.nodes[0];

    const size = entity.size * 2;
    const {x, y} = {x: node.x - 3, y: node.y - 5}

    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = entity.color;
    ctx.arc(x + 3, y + 5, size/3, 0, Math.PI * 2, false);
    ctx.fillStyle = isFill ? entity.color : '#f1f1f1';
    ctx.stroke();
    ctx.fill();
}

function renderName(entity) {
    const { x, y } = entity.nodes[0];

    const { y: dy } = entity.direction;

    ctx.fillStyle = entity.color;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';

    if (dy === -1) {
        ctx.fillText(entity.name, x, y + 15);   
    } else {
        ctx.fillText(entity.name, x, y - 10);
    }
}

function renderSnake(entity) {
    ctx.beginPath();
    entity.nodes.forEach(node => {
        ctx.lineWidth = entity.size;
        ctx.strokeStyle = entity.color;
        ctx.lineCap = 'round';
        ctx.lineTo(node.x, node.y);
    });
    ctx.stroke();
}


function renderPlayer() {
    renderSnake(player);;
    renderSnakeHead({entity: player});
    renderInvulnerableEffect(player);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    [...gameEntities].forEach((entity) => {
        if(entity.id === player.id) return;
        if(entity.type === TYPE.FOOD) {
            renderFood(entity);
            return;
        }

        renderSnake(entity);
        renderSnakeHead({entity, isFill: true});
        renderName(entity);
        renderInvulnerableEffect(entity);
    });

    renderPlayer();}

function getPlayer(entities, playerId = player.id) {
    return entities.find((entity) => entity.id === playerId) || player;
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
    if (player.status === STATUS.DEAD) {
        clearTimeout(ticketTimeOutId);
        clearTimeout(animationTimeOutId);
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

function convertToCountdown({ timeout, maxMs }) {
    const remainingMs = maxMs - (Date.now() - timeout);
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const remainingMinutes = Math.floor(remainingSeconds / 60);

    if (remainingMinutes > 0) {
        const seconds = remainingSeconds % 60;
        return `${remainingMinutes}m ${seconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

function displayVulnerableEffect() {
    const invulnerableTimeleft = convertToCountdown(player.invulnerable);

    if(!isInvulnerableTimedOut(player)) {
        document.getElementById('invulnerable').innerText = 'invulnerable: ' + invulnerableTimeleft;
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

function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    const column = document.createElement('ol');
    [...gameEntities].filter((entity) => entity.type === TYPE.PLAYER).forEach((entity) => {
        addCellToTable(column, entity.name );
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

function updateGameTimeLeft() {
    document.getElementById('timeLeftValue').innerText = convertToCountdown({ timeout: gameTimeLeft, maxMs: maxGameTime});
}

/*function startGameTimeLeft() {
    const intervalId = setInterval(() => {
        gameTimeLeft - 1000;
        if (gameTimeLeft <= 0) {
            gameTimeLeft = 0;
            clearInterval(intervalId);
        }
        updateGameTimeLeft();
    }, 1000);
}*/

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
    displayGameOver();
    displayVulnerableEffect();
    movePlayerEntities();
}

function startGameLoop () {
    sendStartGameToServer();
    startGameUpdate = true;
    //startGameTimeLeft();
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
let gameTimeLeft = null;
let maxGameTime = null;

connection.onmessage = ({data}) => {
    try {
        const {playerId, 
            entities, 
            scoreBoard: sb, 
            isCreator, 
            gameTimeLeft: gt,
            maxGameTime: mt,
            gameStart,
        } = JSON.parse(data);

        if (sb) {
            scoreBoard = sb;
        }

        if (isCreator) {
            showStartGameButton();
        }

        if(gt) {
            gameTimeLeft = gt;
            updateGameTimeLeft();
        }

        if(mt) {
            maxGameTime = mt;
        }

        if(gameStart) {
            startGame();
        }

        if (playerId) {
            player = getPlayer(entities, playerId);
            gameEntities = entities;
        } else if (entities) {
            const updatedEntities = updateEntities(entities);
            player = getPlayer(updatedEntities);
            gameEntities = updatedEntities;
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

let animationTimeOutId = setTimeout(function run() {
    cleanupStaleAnimations();
    animationTimeOutId = setTimeout(run, ANIMATION_TICK_MS);
}, ANIMATION_TICK_MS);

let ticketTimeOutId = setTimeout(function run() {
    updateGame();
    ticketTimeOutId = setTimeout(run, CLIENT_TICK_MS);
}, CLIENT_TICK_MS);
