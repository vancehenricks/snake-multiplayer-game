const DEFAULT_IDLE_SPEED = 5;
const DEFAULT_ENTITY_SIZE = 5;
const CLIENT_TICK_MS = 50;
const CHANNEL = '/game';
const TYPE = {
    PLAYER: 0,
    FOOD: 1,
    OBSTACLE: 2,
}

const STATUS = {
    ALIVE: 0,
    DEAD: 1
}

const UI_ELEMENTS = {
    ANNOUNCEMENT: 'announcement',
    SCORE: 'score',
    EFFECTS: 'effects',
    SCORE_BOARD: 'scoreboard',
    SCORE_BOARD_INSTRUCTION: 'scoreboardInstruction',
}

const CLOSE_VIOLATION = {
    INVALID_ROOMID_GIVEN: 4000,
    ENTITY_TIMEDOUT : 4001,
    INVALID_PLAYER_NAME_GIVEN: 4002,
    GAME_ALREADY_STARTED: 4003,
    GAME_TIMEDOUT: 4004,
    ROOM_FULL: 4005,
    CREATOR_LEFT: 4006,
}

const COLOR = {
    SIGN: '#d3d3d3',
    BACKGROUND: '#f1f1f1',
    ENTITY: '#242424'
}

function establishConnection() {
    const roomId = getRoomId();
    const playerName = getPlayerName();
    connection = new WebSocket(`${ADDR}${CHANNEL}?roomId=${roomId}&playerName=${playerName}`)
    connection.binaryType = 'arraybuffer';
    
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
    if (isCreator()) {
        sendToServer({startGame: true});
    }
}

function sendReadyToServer() {
    isPlayerReady = !isPlayerReady;
    sendToServer({ready: isPlayerReady});
}

function createAnimationId(entityId, animationName) {
    return entityId + ',' + animationName;
}

function getEntityIdFromAnimationId(animationId) {
    return animationId.split(',')[0];
}


function getEntitySize (score, type) {

    if (type === TYPE.PLAYER) { 
        return DEFAULT_ENTITY_SIZE;
    }

    const calculatedScore = DEFAULT_ENTITY_SIZE + score;

    return calculatedScore  > 20 ? 20 : calculatedScore;
}

function renderObstacle({id, score, nodes, type}, isFill) {
    const animationId = createAnimationId(id, 'obstacle');
    const payload = getAnimationFramePayload(animationId);
    const size = getEntitySize(score, type);

    const {x, y} = payload || nodes[0];

    gameCtx.beginPath();
    gameCtx.fillStyle = COLOR.BACKGROUND;
    gameCtx.strokeStyle = COLOR.ENTITY;
    gameCtx.lineWidth = 2; 

    gameCtx.rect(x - size / 2, y - size / 2, size, size);
    gameCtx.fill();
    gameCtx.stroke();

    if (isFill) {
        const innerSize = size / 2;
        gameCtx.beginPath();
        gameCtx.fillStyle = COLOR.ENTITY;
        gameCtx.strokeStyle = COLOR.BACKGROUND;
        gameCtx.lineWidth = 2;
        gameCtx.rect(x - innerSize / 2, y - innerSize / 2, innerSize, innerSize);
        gameCtx.fill();
        gameCtx.stroke();
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

function renderFood({id, score, nodes, type}) {
    const animationId = createAnimationId(id, 'spawn');
    const payload = getAnimationFramePayload(animationId);
    const size = getEntitySize(score, type);

    const {x, y} = payload || nodes[0];

    gameCtx.beginPath();
    gameCtx.lineWidth = 5;
    gameCtx.strokeStyle = COLOR.ENTITY;
    gameCtx.arc(x, y, size/2, 0, Math.PI * 2, false);
    gameCtx.fillStyle = COLOR.BACKGROUND;
    gameCtx.stroke();
    gameCtx.fill();

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
    const entitySize = getEntitySize(entity.score, entity.type);
    const size = payload?.size || entitySize * 2;
    const {x, y} = {x: node.x - 3, y: node.y - 5}
    const snakeColor = getSnakeColor(entity);
    const currentPlace = scoreBoard.findIndex((scoreEntry) => scoreEntry.id === entity.id);

    gameCtx.beginPath();
    gameCtx.lineWidth = 2;
    gameCtx.strokeStyle = snakeColor;
    gameCtx.lineCap = 'round';
    gameCtx.moveTo(node.x, node.y);

    const diagonalOffset = 7;
    const straightOffset = 10;

    if (entity.direction.y === -1 && entity.direction.x === 0) {
        gameCtx.lineTo(node.x, node.y+straightOffset);
    } else if (entity.direction.y === 1 && entity.direction.x === 0) {  
        gameCtx.lineTo(node.x, node.y-straightOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === 0) {
        gameCtx.lineTo(node.x+straightOffset, node.y);
    } else if (entity.direction.x === 1 && entity.direction.y === 0) {
        gameCtx.lineTo(node.x-straightOffset, node.y);
    } else if (entity.direction.x === 1 && entity.direction.y === 1) {
        gameCtx.lineTo(node.x-diagonalOffset, node.y-diagonalOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === 1) {
        gameCtx.lineTo(node.x+diagonalOffset, node.y-diagonalOffset);
    } else if (entity.direction.x === 1 && entity.direction.y === -1) {
        gameCtx.lineTo(node.x-diagonalOffset, node.y+diagonalOffset);
    } else if (entity.direction.x === -1 && entity.direction.y === -1) {
        gameCtx.lineTo(node.x+diagonalOffset, node.y+diagonalOffset);
    }
    
    gameCtx.stroke();

    gameCtx.beginPath();
    gameCtx.lineWidth = 5;
    gameCtx.strokeStyle = snakeColor;
    gameCtx.arc(x + 3, y + 5, size/3, 0, Math.PI * 2, false);
    gameCtx.fillStyle = COLOR.BACKGROUND;
    gameCtx.stroke();
    gameCtx.fill();

    if (currentPlace === 0) {
        gameCtx.beginPath();
        gameCtx.arc(x + 3, y + 5, size / 6, 0, Math.PI * 2, false);
        gameCtx.fillStyle = snakeColor;
        gameCtx.fill(); 
    }

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

    gameCtx.fillStyle = COLOR.ENTITY;
    gameCtx.font = '12px Tahoma, sans-serif';
    gameCtx.textAlign = 'center';

    if (dy === -1) {
        gameCtx.fillText(value, x, y + 28);   
    } else {
        gameCtx.fillText(value, x, y - 22);
    }
}

function renderName(entity) {
    renderLabel({direction: entity.direction, node: entity.nodes[0], value: entity.name});
}

function renderSnake(entity) {
    const snakeColor = getSnakeColor(entity);
    const size = getEntitySize(entity.score, entity.type);

    gameCtx.beginPath();
    gameCtx.lineWidth = size;
    gameCtx.strokeStyle = snakeColor;
    gameCtx.lineCap = 'round';

    entity.nodes.forEach((node, index) => {
        if (index === 0) {
            gameCtx.moveTo(node.x, node.y);
        } else {
            gameCtx.lineTo(node.x, node.y);
        }
    });

    gameCtx.stroke();

    const nodesLeft = entity.nodes.slice(-1);
    nodesLeft.forEach((node) => {
        gameCtx.beginPath();
        gameCtx.lineWidth = 2;
        gameCtx.strokeStyle = snakeColor;
        gameCtx.arc(node.x, node.y, size / 2, 0, Math.PI * 2, false);
        gameCtx.fillStyle = COLOR.BACKGROUND;
        gameCtx.fill();
        gameCtx.stroke();
    });
}


function renderPlayer() {
    renderSnake(player);
    renderSnakeHead(player);
    renderInvulnerableEffect(player);
}

function clearCanvas() {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
}

function getSnakeColor(entity) {
    const isPlayer = isEntityPlayer(entity);

    if (isPlayer) {
        return '#66023c'
    } else {
        return COLOR.ENTITY;
    }
}

function renderInvulnerableEffect(entity) {
    const animationId = createAnimationId(entity.id, 'invulnerable');
    const payload = getAnimationFramePayload(animationId);
    const size = getEntitySize(entity.score, entity.type);
    const {nodes} = entity;
    const {x, y} = nodes[0];
    const secondsLeft = convertToSeconds(getRemainingTimeMs(entity.invulnerable));
    const snakeColor = getSnakeColor(entity);

    if(isInvulnerableTimedOut(entity)) return;

    const endAngle = payload?.value || 0;
    gameCtx.beginPath();
    gameCtx.lineWidth = 1;
    gameCtx.strokeStyle = snakeColor;
    if (secondsLeft < 10) {
        gameCtx.setLineDash([5, 3]);
    } else {
        gameCtx.setLineDash([]);
    }
    gameCtx.arc(x, y, size+endAngle, 5-endAngle, endAngle, false);

    gameCtx.stroke();
    gameCtx.setLineDash([]); //reset line dash some entities might have expect default


    if(payload) {
        if (endAngle <= payload.expected) {
        nextAnimationFrame(animationId, {...payload, value: endAngle+0.5});
        } else {
            nextAnimationFrame(animationId, {...payload, value: 0, expected: Math.PI*2});
        }
    } else {
        nextAnimationFrame(animationId, { intial: 0, value: 0, expected: Math.PI*2});
    }
}

function createUICanvas() {
    const uiCanvas = document.getElementById('gameCanvas');
    uiCanvas.width = 700;
    uiCanvas.height = 700;
    return uiCanvas;
}

function createGameCanvas() {
    const gameCanvas = document.createElement('canvas');
    gameCanvas.width = 600;
    gameCanvas.height = 600;
    return gameCanvas;
}


function createDiagonalPattern() {
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    
    patternCanvas.width = 10;
    patternCanvas.height = 10;

    patternCtx.strokeStyle = COLOR.SIGN;
    patternCtx.lineWidth = 1;
    patternCtx.beginPath();
    patternCtx.moveTo(0, 0);
    patternCtx.lineTo(10, 10);
    patternCtx.stroke();

    return gameCtx.createPattern(patternCanvas, 'repeat');
}

function renderSpawnArea() {
    const squareSize = 50;
    const centerX = gameCanvas.width / 2;
    const centerY = gameCanvas.height / 2;



    const pattern = createDiagonalPattern();

    gameCtx.beginPath();
    gameCtx.strokeStyle = COLOR.SIGN;
    gameCtx.fillStyle = pattern;
    gameCtx.lineWidth = 1;
    gameCtx.rect(centerX - squareSize / 2, centerY - squareSize / 2, squareSize, squareSize);
    gameCtx.fill();
    gameCtx.stroke();
}

function renderEntities() {
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


function renderAnnouncement(text) {
    addUIElement({id: UI_ELEMENTS.ANNOUNCEMENT, render: () => { 
        const lines = text.split('\n');
        const lineHeight = 28;
        uiCtx.textAlign = 'center';

        lines.forEach((line, index) => {
            if (index === 0) {
                uiCtx.font = '30px Tahoma, sans-serif';
                uiCtx.fontWeight = 'bold';
                uiCtx.fillStyle = COLOR.ENTITY;        
                uiCtx.fillText(line, uiCanvas.width / 2, uiCanvas.height / 2);
                return;
            }

            uiCtx.font = '20px Tahoma, sans-serif';
            uiCtx.fontWeight = 'bold';
            uiCtx.fillStyle = COLOR.ENTITY;    
            uiCtx.fillText(line, uiCanvas.width / 2, uiCanvas.height / 2 + index * lineHeight);
        });
    }});
}

function updateUIScore() {
    addUIElement({id: UI_ELEMENTS.SCORE, render: () => {
        const topMargin = 30;
        const leftMargin = 10;
        uiCtx.textAlign = 'left';
        uiCtx.font = '24px Tahoma, sans-serif';
        uiCtx.fontWeight = 'bold';
        uiCtx.fillStyle = COLOR.ENTITY;
        uiCtx.fillText(`🏆 ${player.score}`, leftMargin, topMargin);
    }});
}

function updateUIGameTimeLeft() {
    if (gameTime === null) return;

    addUIElement({id: UI_ELEMENTS.TIMELEFT, render: () => {
        const topMargin = 30;
        uiCtx.textAlign = 'center';
        uiCtx.font = '24px Tahoma, sans-serif';
        uiCtx.fontWeight = 'bold';
        uiCtx.fillStyle = COLOR.ENTITY;
        uiCtx.fillText(`⏱️ ${convertToCountdown(gameTime)}`, uiCanvas.width / 2, topMargin);
    }});
}

function updateUIEffects() {
    addUIElement({id: UI_ELEMENTS.EFFECTS, render: () => {
        const topMargin = 30;
        const rightMargin = 10;
        uiCtx.textAlign = 'right';
        uiCtx.font = '24px Tahoma, sans-serif';
        uiCtx.fontWeight = 'bold';
        uiCtx.fillStyle = COLOR.ENTITY;

        const invulnerableTimeleft = convertToCountdown(player.invulnerable);

        if (!isInvulnerableTimedOut(player)) {
            uiCtx.fillText(`🛡️ ${invulnerableTimeleft}`, uiCanvas.width - rightMargin, topMargin);
        } else {
            removeUIElement({id: UI_ELEMENTS.EFFECTS});
        }
    }});
}

function updateUIScoreBoardInstruction() {
    addUIElement({id: UI_ELEMENTS.SCORE_BOARD_INSTRUCTION, render: () => {
        const bottomMargin = 10;
        const rightMargin = 10;
        uiCtx.textAlign = 'right';
        uiCtx.font = '24px Tahoma, sans-serif';
        uiCtx.fontWeight = 'bold';
        uiCtx.fillStyle = COLOR.ENTITY;
        uiCtx.fillText('[V] 📝', uiCanvas.width - rightMargin, uiCanvas.height - bottomMargin);
    }});
}


function renderCountdown() {
    let countDownStartGame = 4;

    function countdown() {
        countDownStartGame--;

        if (countDownStartGame === 0) {
            renderAnnouncement('START');
        } else {
            renderAnnouncement(countDownStartGame+'');
        }

        if (countDownStartGame < 0) { 
            removeUIElement({id: UI_ELEMENTS.ANNOUNCEMENT});
            startGameLoop();
        } else {
            setTimeout(countdown, 1000);
        }
    }

    countdown();
}

function removeAllUIElement() {
    ui = [];
}

function displayGameOver() {
    stopGameLoop();
    removeAllUIElement();
    renderAnnouncement('Game Over');
}

function displayWinner() {
    stopGameLoop();
    removeAllUIElement();
    const sb = getScoreBoard();
    renderAnnouncement(`🏆\n${sb[0].name}\n\n\n\n\n[Enter] Return to Menu`);
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

function getRemainingTimeMs({ timeout, maxMs }) {
    return  maxMs - (Date.now() - timeout);
}

function convertToCountdown({ timeout, maxMs }) {
    const remainingMs = maxMs - (Date.now() - timeout);
    const remainingSeconds = convertToSeconds(remainingMs);
    const remainingMinutes = convertToMinutes(remainingSeconds);

    if (remainingMinutes > 0) {
        const seconds = remainingSeconds % 60;
        return `${remainingMinutes}:${seconds}`;
    } else {
        return `${remainingSeconds}`;
    }
}

function addCellToTable(table, value) {
    const column = document.createElement('li');
    column.innerText = value;
    table.appendChild(column);
}

function drawPlayerScoreTable(roomName, players) {
    const tableWidth = 300;
    const tableHeight = players.length * 30 + 70;
    const startX = (uiCanvas.width - tableWidth) / 2;
    const startY = (uiCanvas.height - tableHeight) / 2;

    uiCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    uiCtx.fillRect(startX, startY, tableWidth, tableHeight);

    uiCtx.fillStyle = 'white';
    uiCtx.font = '18px Arial';
    uiCtx.textAlign = 'center';
    uiCtx.fillText(roomName, startX + tableWidth / 2, startY + 30);

    uiCtx.font = '16px Arial';
    uiCtx.textAlign = 'left';
    uiCtx.fillText('Player', startX + 20, startY + 60);
    uiCtx.textAlign = 'right';
    uiCtx.fillText('Score', startX + tableWidth - 20, startY + 60);

    uiCtx.strokeStyle = 'white';
    uiCtx.lineWidth = 1;
    uiCtx.beginPath();
    uiCtx.moveTo(startX + 20, startY + 70);
    uiCtx.lineTo(startX + tableWidth - 20, startY + 70);
    uiCtx.stroke();


    
    uiCtx.font = '14px Arial';
    players.forEach((p, index) => {
        const y = startY + 90 + index * 30;

        let playerName = p.id === player.id ? p.name + ' (You)' : p.name;

        if (index === 0) {
            playerName = '🥇 ' + playerName
        } else if (index === 1) {
            playerName = '🥈 ' + playerName;
        } else if (index === 2) {
            playerName = '🥉 ' + playerName;
        }

        uiCtx.textAlign = 'left';
        uiCtx.fillText(playerName, startX + 20, y);
        uiCtx.textAlign = 'right';
        uiCtx.fillText(p.score, startX + tableWidth - 20, y);
        if (index === players.length - 1) return;
        uiCtx.beginPath();
        uiCtx.moveTo(startX + 20, y + 10);
        uiCtx.lineTo(startX + tableWidth - 20, y + 10);
        uiCtx.stroke();
    });
}

function updateUIScoreBoard() {
    if (openScoreBoard) {
        addUIElement({id: UI_ELEMENTS.SCORE_BOARD, render: () => {
            drawPlayerScoreTable(getRoomId(), scoreBoard);
        }});
    } else {
        removeUIElement({id: UI_ELEMENTS.SCORE_BOARD});
    }
}

function scoreBoardControls() {
    if (keys['v'] || keys['V']) {
        openScoreBoard = true;
    } else {
        openScoreBoard = false;
    }
}

function gameOverControls() {
    if (keys['Enter'] && isGameOver) {
        returnToMenu();
    }
}

function isInReadyList(entity) {
    return readyList.includes(entity.id);
}

function numberOfPlayersReady() {
    return readyList.length;
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

        if (isEntityPlayer(entity) && !isEntityCreator) {
            label = isPlayerReady ? '(You)✅' : '(You)❌';
        }

        if (isEntityPlayer(entity) && isEntityCreator) {
            label = '(Host)(You)';
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
        return [...gameEntities].some((entity) => entity.id == getEntityIdFromAnimationId(animation.id));
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

            const newNode = createNode({x: Math.floor(x - dx * speed), 
                y: Math.floor(y - dy * speed)});


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

    const ENTITY_PROPERTIES = [
        'type',
        'id',
        'name',
        'score',
        'tail',
        'direction',
        'invulnerable',
        'timeout',
        'status',
        'nodes',
        'animation', //in client only
    ]

    let hits = 0;
    ENTITY_PROPERTIES.forEach(property => {
        Object.keys(entity).forEach(key => {
            if(property === key) hits += 1;
        })
    });

    return hits === ENTITY_PROPERTIES.length;
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

        return { ...gameEntity, ...updatedEntity };

    }).filter(entity => hasCompleteProperties(entity))

    const removedDuplicates = [...gameEntities].filter(gameEntity => 
        !updatedEntities.some(entity => gameEntity.id === entity.id)
    )

    return [...updatedEntities, ...removedDuplicates]

}

function removeDeadEntities() {
    gameEntities = [...gameEntities].filter(gameEntity => gameEntity.status === STATUS.ALIVE)
}

function renderWall() {
    const spikeLength = 5;
    const spikeSpacing = 15;

    gameCtx.strokeStyle = COLOR.SIGN;
    gameCtx.lineWidth = 2;

    for (let x = 0; x < gameCanvas.width - spikeLength; x += spikeSpacing) {
        gameCtx.beginPath();
        gameCtx.moveTo(x, 0);
        gameCtx.lineTo(x + spikeLength / 2, spikeLength);
        gameCtx.lineTo(x + spikeLength, 0);
        gameCtx.stroke();
    }

    for (let x = 0; x < gameCanvas.width - spikeLength; x += spikeSpacing) {
        gameCtx.beginPath();
        gameCtx.moveTo(x, gameCanvas.height);
        gameCtx.lineTo(x + spikeLength / 2, gameCanvas.height - spikeLength);
        gameCtx.lineTo(x + spikeLength, gameCanvas.height);
        gameCtx.stroke();
    }

    for (let y = 0; y < gameCanvas.height - spikeLength; y += spikeSpacing) {
        gameCtx.beginPath();
        gameCtx.moveTo(0, y);
        gameCtx.lineTo(spikeLength, y + spikeLength / 2);
        gameCtx.lineTo(0, y + spikeLength);
        gameCtx.stroke();
    }

    for (let y = 0; y < gameCanvas.height - spikeLength; y += spikeSpacing) {
        gameCtx.beginPath();
        gameCtx.moveTo(gameCanvas.width, y);
        gameCtx.lineTo(gameCanvas.width - spikeLength, y + spikeLength / 2);
        gameCtx.lineTo(gameCanvas.width, y + spikeLength);
        gameCtx.stroke();
    }
}

function updateGame() {
    cleanupStaleAnimations();
    clearCanvas();
    renderWall();
    renderSpawnArea();
    generateScoreBoard();
    gameOverControls();
    if (!startGameUpdate) {
        updatePlayerList();
        removeDeadEntities();
        renderUI();
        return;
    };

    updateUIScoreBoard();
    updateUIScore();
    playerControl();
    scoreBoardControls();
    renderEntities();
    movePlayerEntities();

    updateUIEffects();
    updateUIGameTimeLeft();
    updateUIScoreBoardInstruction();
    removeDeadEntities();
    renderGameCanvasToUICanvas();
    renderUI();
}

function isCreator(id = player.id) {
    return creatorId === id;
}

function stopGameLoop () {
    startGameUpdate = false;
    isGameOver = true;
}

function startGameLoop  () {
    startGameUpdate = true;
}


function convert1DArrayToNodes (array) {
    let nodes = [];
    for (let i = 0; i < array.length; i += 2) {
        nodes.push({x: array[i], y: array[i+1]});
    }
    return nodes;
}

function convert1DArrayToInvulnerable (array) {
    return {
        timeout: array[0],
        maxMs: array[1],
    }
}

function convert1DArrayToDirection (array) {
    return {
        x: array[0],
        y: array[1],
    }
}

function convert1DArrayToTail (array) {
    return {
        current: array[0],
        max: array[1],
    }
}

function convertEntities1DArrayToObject(entities) {
    return [...entities].map(entity => {
        let updatedEntity = { ...entity };

        if (entity.nodes) {
            updatedEntity.nodes = convert1DArrayToNodes(entity.nodes);
        }
        if (entity.invulnerable) {
            updatedEntity.invulnerable = convert1DArrayToInvulnerable(entity.invulnerable);
        }
        if (entity.direction) {
            updatedEntity.direction = convert1DArrayToDirection(entity.direction);
        }
        if (entity.tail) {
            updatedEntity.tail = convert1DArrayToTail(entity.tail);
        }

        return updatedEntity;
    });
}


function readyListMatchesCurrentPlayers() {
    const players = [...gameEntities].filter(entity => entity.type === TYPE.PLAYER);
    return players.length === readyList.length;
}

function getPlayerCount () {
    return [...gameEntities].filter(entity => entity.type === TYPE.PLAYER).length;
}

function addUIElement(element) {
    if (ui.some(uiElement => uiElement.id === element.id)) {
        removeUIElement(element);
    }
    ui = [...ui, element];
}

function removeUIElement(element) {
    ui = [...ui].filter(uiElement => uiElement.id !== element.id);
}

function renderUI () {
    ui.forEach(({render}) => {
        render();
    });
}

function renderGameCanvasToUICanvas () {
    const centerX = (uiCanvas.width - gameCanvas.width) / 2;
    const centerY = (uiCanvas.height - gameCanvas.height) / 2;
    uiCtx.drawImage(gameCanvas, centerX, centerY);

}

function decodeDirection(value) {
    return value-5;
}

function uint32ArrayToString(arr) {
    return String.fromCodePoint(...arr);
}

function combineThreePartsTo64BitInteger(part1, part2, part3) {
    const twoPow40 = 1099511627776;
    const twoPow20 = 1048576;
    return (part1 * twoPow40) + (part2 * twoPow20) + part3;
}

function decodeTwo16BitNumbers(combined) {
    const high = (combined >> 16) & 0xFFFF;
    const low = combined & 0xFFFF;
    return { high, low };
}

function decodeNodes(nodes) {
    let unpackedNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        const { high, low } = decodeTwo16BitNumbers(nodes[i]);
        unpackedNodes.push(high, low);
    }
    return unpackedNodes;
}

function convertToEntities(uInt32Array) {
    const PAYLOAD_DELIMETER = {
        ID: 4294967295,
        TYPE : 4294967294,
        NAME: 4294967293,
        SCORE: 4294967291,
        TAIL: 4294967290,
        DIRECTION: 4294967289,
        INVULNERABLE: 4294967288,
        TIMEOUT: 4294967287,
        STATUS: 4294967286,
        NODES: 4294967285,
    }
    
    
    const PAYLOAD_PROPERTIES = {
        ID: 'id',
        TYPE: 'type',
        NAME: 'name',
        SCORE: 'score',
        TAIL: 'tail',
        DIRECTION: 'direction',
        INVULNERABLE: 'invulnerable',
        TIMEOUT: 'timeout',
        STATUS: 'status',
        NODES: 'nodes',
    }

    let entities = [];
    let currentEntity = {};
    let currentNodes = [];
    let currentDirection = [];
    let currentInvulnerable = [];
    let currentTail = [];
    let currentName = [];
    let currentKey = null;

    function addEntity() {
        if (!currentEntity.id) return;

        if (currentNodes.length > 0) {
            currentEntity = { ...currentEntity, nodes: decodeNodes(currentNodes) };
        }
        if (currentDirection.length > 0) {
            const { high, low } = decodeTwo16BitNumbers(currentDirection);
            currentEntity = { ...currentEntity, direction: [decodeDirection(high), decodeDirection(low)] };
        }
        if (currentInvulnerable.length > 0) {
            const timeout = combineThreePartsTo64BitInteger(...currentInvulnerable.slice(0, -1));
            const maxMs = currentInvulnerable[currentInvulnerable.length - 1];
            currentEntity = { ...currentEntity, invulnerable: [ timeout, maxMs ] };
        }
        if (currentTimeout.length > 0) {
            const timeout = combineThreePartsTo64BitInteger(currentTimeout);
            currentEntity = { ...currentEntity, timeout };
        }
        if (currentTail.length > 0) {
            const { high, low } = decodeTwo16BitNumbers(currentTail);
            currentEntity = { ...currentEntity, tail: [ high, low ] };
        }
        if (currentName.length > 0) {
            currentEntity = { ...currentEntity, name: uint32ArrayToString(currentName) };
        }
        entities = [...entities, currentEntity];
    }

    for (let i = 0; i < uInt32Array.length; i++) {
        const value = uInt32Array[i];
        if (value === PAYLOAD_DELIMETER.ID) {
            addEntity();
            currentEntity = {};
            currentNodes = [];
            currentDirection = [];
            currentInvulnerable = [];
            currentTimeout = [];
            currentTail = [];
            currentName = [];
            currentKey = PAYLOAD_PROPERTIES.ID;
        } else if (value === PAYLOAD_DELIMETER.TYPE) {
            currentKey = PAYLOAD_PROPERTIES.TYPE;
        } else if (value === PAYLOAD_DELIMETER.NAME) {
            currentKey = PAYLOAD_PROPERTIES.NAME;
        } else if (value === PAYLOAD_DELIMETER.SCORE) {
            currentKey = PAYLOAD_PROPERTIES.SCORE;
        } else if (value === PAYLOAD_DELIMETER.TAIL) {
            currentKey = PAYLOAD_PROPERTIES.TAIL;
        } else if (value === PAYLOAD_DELIMETER.DIRECTION) {
            currentKey = PAYLOAD_PROPERTIES.DIRECTION;
        } else if (value === PAYLOAD_DELIMETER.INVULNERABLE) {
            currentKey = PAYLOAD_PROPERTIES.INVULNERABLE;
        } else if (value === PAYLOAD_DELIMETER.TIMEOUT) {
            currentKey = PAYLOAD_PROPERTIES.TIMEOUT;
        } else if (value === PAYLOAD_DELIMETER.STATUS) {
            currentKey = PAYLOAD_PROPERTIES.STATUS;
        } else if (value === PAYLOAD_DELIMETER.NODES) {
            currentKey = PAYLOAD_PROPERTIES.NODES;
        } else {
            if (currentKey === PAYLOAD_PROPERTIES.NODES) {
                currentNodes = [...currentNodes, value];
            } else if (currentKey === PAYLOAD_PROPERTIES.DIRECTION) {
                currentDirection = [...currentDirection, value];
            } else if (currentKey === PAYLOAD_PROPERTIES.INVULNERABLE) {
                currentInvulnerable = [...currentInvulnerable, value];
            } else if (currentKey === PAYLOAD_PROPERTIES.TAIL) {
                currentTail = [...currentTail, value];
            } else if (currentKey === PAYLOAD_PROPERTIES.NAME) {
                currentName = [...currentName, value];
            } else if (currentKey === PAYLOAD_DELIMETER.TIMEOUT) {
                currentTimeout = [...currentTimeout, value];
            } else {
                currentEntity = { ...currentEntity, [currentKey]: value };
            }
        }
    }
  
    addEntity();

    return entities;
}

function convertToObject({data}) {
    
    if (data instanceof ArrayBuffer) {
        const uint32Array = new Uint32Array(data);
        const entities = convertToEntities(uint32Array)
        
        const convertedEntities = convertEntities1DArrayToObject(entities);  

        return { entities: convertedEntities};  
    } else if (typeof data === "string") {
        return JSON.parse(data);
    }

    return {};
}

function getScoreBoard() {
    return [...gameEntities].filter(entity => entity.type === TYPE.PLAYER)
    .sort((a, b) => b.score - a.score);
}

function generateScoreBoard() {
    scoreBoard = getScoreBoard();
}

establishConnection();
let gameCanvas = createGameCanvas();
let uiCanvas = createUICanvas();
let gameCtx = gameCanvas.getContext('2d');
let uiCtx = uiCanvas.getContext('2d');
let ui = [];
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
let openScoreBoard = false;
let isGameOver = false;

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
    else if (code === CLOSE_VIOLATION.INVALID_PLAYER_NAME_GIVEN) {
        alert('Invalid player name given');
        returnToMenu();
    }
    else if (code === CLOSE_VIOLATION.ROOM_FULL) {
        alert('Room is full');
        returnToMenu();
    }
    else if (code === CLOSE_VIOLATION.CREATOR_LEFT) {
        alert('Host left the room');
        returnToMenu();
    }
}

connection.onmessage = (event) => {

    try {
        const {playerId, 
            entities, 
            creatorId: ci,
            readyList: rl, 
            gameTime: gt,
            gameStarted,
            inLobby,
        } = convertToObject(event);

        if (ci) {
            creatorId = ci;
        }

        if(gt) {
            gameTime = gt;
        }

        if(gameStarted && !isCreator()) {
            startGame();
        }

        if (inLobby && entities) {
            gameEntities = addAnimationIndicatorsToEntities(entities);
        } else if (entities) {
            let convertedEntities = addAnimationIndicatorsToEntities(entities);

            if (playerId) {
                player = getPlayer(convertedEntities, playerId);
                gameEntities = convertedEntities;
            } else {
                convertedEntities = updateEntities(convertedEntities);
                player = getPlayer(convertedEntities);
                gameEntities = convertedEntities;
            }
        }

        if (rl) {
            readyList = rl;
            const numberOfPlayers = ` (${numberOfPlayersReady()}/${getPlayerCount()})`;

            if(readyListMatchesCurrentPlayers() && isCreator()) {
                showReminder('All players are ready' + numberOfPlayers);
                showStartGameButton();
            } else {
                showReminder('Waiting for players to be ready' + numberOfPlayers);
                hideStartGameButton();
            }

            if (readyListMatchesCurrentPlayers() && !isCreator()) {
                showReminder('Waiting for host to start the game' + numberOfPlayers);
            }

            if (!isCreator()) {
                showReadyButton();
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
    updateGame();
    setTimeout(run, CLIENT_TICK_MS);
}, CLIENT_TICK_MS);
