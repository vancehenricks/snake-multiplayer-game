const GAME_TICK_MS = 100;
const SCOREBOARD_MS = 1000;
const DEFAULT_ENTITY_SIZE = 5;
const DEFAULT_IDLE_SPEED = 5;
const IDLE_TIMEOUT_MS = 30000;
const GAME_TIME_MS = 300000;
const DEFAULT_INVULNERABLE_TIMEOUT_MS = 5000;
const MAX_SCORES_TO_SHOW = 12;
const MAX_FOOD = 10;
const MAP = {
    WIDTH: 500,
    HEIGHT: 500

}
const TYPE = {
    PLAYER: 'player',
    FOOD: 'food'
}

const STATUS = {
    ALIVE: 'alive',
    DEAD: 'dead'
}

const CHANNEL = '/game';


var https = require('https')
var http = require('http')
var fs = require('fs')
const express = require('express');
var expressWs = require('express-ws');
require('dotenv').config();

function createOptions () {

    return { 
        key: fs.readFileSync(process.env.KEY_PATH),
        cert: fs.readFileSync(process.env.CERT_PATH)
    }
};

var app = express();
var server = process.env.ENV !== 'development' ? https.createServer(createOptions(), app): http.createServer(app)
var expressWs = expressWs(app, server);

const path = require('path');

app.use(express.static(path.join(__dirname, 'client/public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/public', 'index.html'));
});

const aWss = expressWs.getWss(CHANNEL);

server.listen(process.env.PORT)

console.log('Server listening on port:', process.env.PORT);

function generateEntityProperties(entity) {
    let updatedEntity = {};
    Object.keys(entity.touched).forEach((property) => {

        updatedEntity = {
            ...updatedEntity,
            [property]: entity[property]
        }
    })

    return updatedEntity;
}

function isTouchedEmpty(entity) {
    return Object.keys(entity?.touched).length > 0;
}

function renderEntitiesToClients(room, options) {

    const touchedEntities = [...room.gameEntities].filter(gameEntity =>
        isTouchedEmpty(gameEntity)
    )
    const unusedPropertiesRemoved = touchedEntities.map(entity => generateEntityProperties(entity));
    
    if(unusedPropertiesRemoved.length > 0) {
        aWss.clients.forEach((client) => {
            if (client === options?.excluding) return;
            client.send(JSON.stringify({entities: unusedPropertiesRemoved}));
        })
    }
}

function untouchedGameEntities(room) {
    room.gameEntities = [...room.gameEntities].map(entity => {
        return {
            ...entity,
            touched: {},
        }
    });
}

function removeClientFromGameEntities() {
    return [...gameEntities].map(gameEntity => {
        return {
            ...gameEntity,
            client: undefined,
        }
    })
}

function removeClientFromGameEntity(entity) {
    return {
        ...entity,
        client: undefined,
    }
}

function renderEverythingToClient(room, client, player) {

    client.send(JSON.stringify({player: removeClientFromGameEntity(player), entities: removeClientFromGameEntities(), scoreBoard, roomId: room.roomId, gameTimeLeft: room.gameTimeLeft}));
}

function updateEntityFromMap(room, entity) {
    room.gameEntities = [...room.gameEntities].map(gameEntity => {
        if(gameEntity.id === entity.id) {
           return { ...gameEntity, ...entity };
        }
        return gameEntity;
    });
}

function touchListOfKeys (entity) {
    let touched = {};
    Object.keys(entity).forEach(key => {
        touched = { ...touched, [key]: true}
    })

    return touched;
}

function isValidName ({name}) {
    if(!name) return false; 
    if(name.length > 12) return false;
    if(!new RegExp(/^\w+$/).test(name)) return false;
    return true;
}

function isValidDirection ({direction}) {
    if(!direction) return false
    if(!direction?.x && !direction?.y) return false;
    if(direction.x > 1 || direction.x < -1) return false;
    if(direction.y > 1 || direction.y < -1) return false;

    return true;
}

function isValidTimeout ({timeout}) {
    if(!timeout) return false;
    if(typeof timeout !== Number) return false;

    return true;
}

function isValidId ({id}, {id: refId}) {
    if(!id) return false
    if(id !== refId) return false;

    return true;
}

function sanitizeEntity(entity, refEntity) {

    if(!isValidId(entity, refEntity)) return null;

    let updatedEntity = { id: entity.id }

    if (isValidName(entity)) {
        updatedEntity = {...updatedEntity, name: entity.name,}
    }

    if (isValidDirection(entity)) {
        updatedEntity = {...updatedEntity, direction: entity.direction,}
    }

    if (isValidTimeout(entity)) {
        updatedEntity = {...updatedEntity, timeout: entity.timeout,}
    }

    updatedEntity = { ...updatedEntity, touched: touchListOfKeys(updatedEntity)}
    
    return updatedEntity;
}

function updateEntityTimeOut(entity) {
    return {...entity, timeout: Date.now()};
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateRandomColor() {
    var letters = '01234567';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 8)];
    }
    return color;
}

function generateRandomPosition() {
    const offset = 30;
    return {
        x: Math.floor(Math.random() * (MAP.WIDTH - offset)),
        y: Math.floor(Math.random() * (MAP.HEIGHT - offset))
    }
}

function createNode ({x, y}) {
    return {
        x,
        y,
    }
}

function createTail ({current, max}) {
    return {current, max};
}

function updateNodePositions (entity) {
    for (let i = entity.nodes.length - 1; i > 0; i--) {
        entity.nodes[i] = entity.nodes[i-1];
    }
    return entity;
}

function generateRandomNumber(min, max) {
    return Math.floor(Math.random() * (max+1 - min)) + min;
}

function generateRandomDirection() {
    let x = generateRandomNumber(0, 1);
    let y = generateRandomNumber(0, 1);

    if(x === 0) x = -1;
    if(y === 0) y = -1;
    
    return createNode({x, y});
}

function createInvulnerableState({
    timeout=Date.now(),
    maxMs=DEFAULT_INVULNERABLE_TIMEOUT_MS,
}={}) {
    return {
        timeout,
        maxMs,
    }
}

function touchAllProperties() {
    return {
        type: true,
        id: true,
        position: true,
        name: true,
        color: true,
        size: true,
        score: true,
        tail: true,
        direction: true,
        invulnerable: true,
        timeout: true,
        status: true,
        nodes: true,
    }
}

let rooms = {};

function createRoom(roomId, creator) {
    rooms[roomId] = {
        roomId,
        gameEntities: [],
        scoreBoard: [],
        scoreTouched: true,
        tickTimeOutId: null,
        scoreBoardTimeOutId: null,
        gameTimeLeft: GAME_TIME_MS,
        creator: creator,
        gameStarted: true,

    };
}

function deleteRoom(room) {
    delete rooms[room.roomId]
}

function getRoom(roomId) {
    return rooms[roomId];
}

function addEntityToRoom(room, entity) {
    if (room) {
        room.gameEntities = [...room.gameEntities, entity];
    }
}

function createEntity({
    roomId,
    type=TYPE.PLAYER,
    id=generateId(),
    position=generateRandomPosition(),
    name='Player',
    color=generateRandomColor(),
    size=DEFAULT_ENTITY_SIZE,
    score=0,
    tail=createTail({current: 0, max: 4}),
    direction=generateRandomDirection(),
    invulnerable=createInvulnerableState(),
    timeout=Date.now(),
    status=STATUS.ALIVE,
    client=undefined}={}) {

    const nodes = [createNode(position)];
    const touched=touchAllProperties();

    const entity = {type, name, id, color, size, nodes, score, direction, invulnerable, tail, status, timeout, touched, client};

    if (roomId) {
        const room = getRoom(roomId);
        addEntityToRoom(room, entity);
    }

    return entity;
}

function foodEntitiesCount(room) {
    return room ? room.gameEntities.filter((entity) => entity.type === TYPE.FOOD).length : 0;
}

function generateRandomRange(min, max) {
    return Math.floor((Math.random() * (max - min + 1)) + min);
 }

 function spawnFoodEntities(room) {
    if (!room || foodEntitiesCount(room) > MAX_FOOD) return;

    const score = generateRandomRange(1, 3);
    const food = createEntity({
        roomId: room.roomId,
        type: TYPE.FOOD,
        name: 'Food',
        tail: createTail({current: 0, max: 0}),
        size: DEFAULT_ENTITY_SIZE + score / .9,
        color: generateRandomColor(),
        position: generateRandomPosition(),
        direction: createNode({x: 0, y: 0}),
        score,
    });

    addEntityToRoom(room, food);
}


function addNodeToEntity(entity) { 
    let newEntity = {...entity};
    const lastNode = newEntity.nodes[newEntity.nodes.length - 1];

    if(newEntity.tail.current < newEntity.tail.max) {
        newEntity.nodes = [...newEntity.nodes, lastNode];
        newEntity.tail.current += 1;

        //console.log('New node:', newEntity.nodes);
    }
    return newEntity;
}

function stopWhenOutOfBounds(entity) {
    const {x, y} = entity.nodes[0];
    const offset = entity.size*1.5;

    if(x < offset || x > MAP.WIDTH-offset || y < offset || y > MAP.HEIGHT-offset) {
        return killEntity(entity);
    }
    return entity;
}

function hasIntersect(entity1, entity2) {

    for(let index = 0; index < entity1.nodes.length; index++) {
        const {x: x1, y: y1} = entity1.nodes[index];

        for(let index2 = 0; index2 < entity2.nodes.length; index2++) {
            if(entity2.status === STATUS.DEAD) continue;

            const {x: x2, y: y2} = entity2.nodes[index2];
            let offset = entity1.size + entity2.size;

            const isSelf = isEntitySelf(entity1, entity2);

            if (isSelf) {
                offset = entity1.size;
                if(index2 < 2) continue;
            }

            if(x1 < x2 + offset &&
                x1 + offset > x2 &&
                y1 < y2 + offset &&
                y1 + offset > y2) {
    
                return {hitNode1: index, hitNode2: index2};
            }
        }
    }

    return {hitNode1: -1, hitNode2: -1};
}

function hasHitHeadNode(hits) {
    const { hitNode1, hitNode2 } = hits;
    return hitNode1 === 0 && hitNode2 === 0;
}

function hasHitTailNode1(hits) {
    const { hitNode1, hitNode2 } = hits;
    return hitNode1 > 0 && hitNode2 === 0;
}

function hasHitTailNode2(hits) {
    const { hitNode1, hitNode2 } = hits;
    //we check for > 1 since 1 and 0 would have the same coordinates no idea why
    return hitNode1 === 0 && hitNode2 > 1;
}

function isEntitySelf(entity1, entity2) {
    return entity1.id === entity2.id;
}

function addScoreToEntity(entity, score) {
    scoreTouched = true;
    return {...entity, tail: {...entity.tail, max: entity.tail.max + score},
    score: entity.score + score, touched: {id: true, tail: true, score: true}};
}

function killEntity(entity) {
    return {...entity, direction: {x: 0, y: 0}, status: STATUS.DEAD, touched: {id: true, direction: true, status: true,}};
}

function intersectPlayerToPlayer({entity, gameEntity, hits}) {
    if (isEntitySelf(entity, gameEntity) || entity.type !== TYPE.PLAYER || 
     gameEntity.type !== TYPE.PLAYER) return entity;

    if(hasHitTailNode2(hits) || hasHitHeadNode(hits)) {
        return killEntity(entity);
    }

    if(hasHitTailNode1(hits)) {
        return addScoreToEntity(entity, gameEntity.score);
    }

    return entity;
}

function intersectPlayerToFood({entity, gameEntity, hits}) {
    if(entity.type === TYPE.PLAYER && gameEntity.type === TYPE.FOOD && hasHitHeadNode(hits)) {

        return addScoreToEntity(entity, gameEntity.score);
    }

    return entity;
}

function intersectFoodToPlayer({entity, gameEntity, hits}) {

    if(entity.type === TYPE.FOOD && gameEntity.type === TYPE.PLAYER && hasHitHeadNode(hits)) {
        return killEntity(entity);
    }
    return entity;
}

function intersectSelf({entity, gameEntity, hits}) {
    if (!isEntitySelf(entity, gameEntity) || 
        entity.type !== TYPE.PLAYER ||
        gameEntity.type !== TYPE.PLAYER) return entity;

    //console.log('Intersecting self:', hits);

    if(hasHitTailNode2(hits)) {
        return killEntity(entity);
    }

    return entity;
}

function isIdleTimedOut(entity) {
    //console.log('timeout', Date.now() - entity.timeout, TIMEOUT_MS, entity.timeout);
    if (Date.now() - entity.timeout > IDLE_TIMEOUT_MS) {
        return true;
    }
    return false;
}

function isInvulnerableTimedOut(entity) {
    if (Date.now() - entity.invulnerable.timeout > entity.invulnerable.maxMs) {
        return true;
    }
    return false;

}

function markDeadForIdleTimedOutEntities(room) {
    room.gameEntities = [...room.gameEntities].map((entity) => {
        if(isIdleTimedOut(entity)) {
            //console.log('Removing entity:', entity);
            return killEntity(entity);
        }
        return entity;
    });
}

function removeDeadEntities(room) {
    room.gameEntities = [...room.gameEntities].filter((entity) => {
        if(entity.status === STATUS.DEAD) {
            if(entity.type === TYPE.PLAYER) {
                console.log('Terminating client IP:', entity.client._socket.remoteAddress);
                entity.client.terminate();
            }

            return false;
        }
        return true;
    });
}

function checkForIntersect(room) {
    const entities = [...room.gameEntities];
    entities.forEach((entity) => {
        let updatedEntity = stopWhenOutOfBounds(entity);
        entities.forEach((gameEntity) => {
            const hits = hasIntersect(updatedEntity, gameEntity);
            updatedEntity = intersectPlayerToFood({entity: updatedEntity, gameEntity, hits});
            updatedEntity = intersectFoodToPlayer({entity: updatedEntity, gameEntity, hits});
            if(!isInvulnerableTimedOut(updatedEntity)) return;
            updatedEntity = intersectPlayerToPlayer({entity: updatedEntity, gameEntity, hits});
            updatedEntity = intersectSelf({entity: updatedEntity, gameEntity, hits});
        });
        updateEntityFromMap(room, updatedEntity);
    });
}

function movePlayerEntities(room) {
    [...room.gameEntities].forEach((entity) => {
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
            updatedNodes = touchNodes(updatedNodes);
            updateEntityFromMap(room, updatedNodes);
        }
    });
}

function createScoreEntry({id, name, score}) {
    return {id, name, score, date: Date.now()};
}

function sortEntryToScoreBoard(room, scoreEntry) {;
    let initialScoreBoard = removeInScoreBoard(room, scoreEntry);
    initialScoreBoard = [...initialScoreBoard, scoreEntry];
    room.scoreBoard = initialScoreBoard.sort((a, b) => b.score - a.score).slice(0, MAX_SCORES_TO_SHOW);
}

function removeInScoreBoard(room, scoreEntry) {
    return [...room.scoreBoard].filter((entry) => entry.id !== scoreEntry.id);
}

function calculateScoresOfPlayers(room) {
    [...room.gameEntities].forEach((entity) => {
        if(entity.type === TYPE.PLAYER) {
             const scoreEntry = createScoreEntry({...entity});
            sortEntryToScoreBoard(scoreEntry);
        }
    });
}

function renderScoreBoardToClients() {
    aWss.clients.forEach((client) => {
        if(scoreTouched) {
            client.send(JSON.stringify({scoreBoard}));
        }
    })
    scoreTouched = false;
}

function getCenterPosition() {
    return {
        x: Math.floor(MAP.WIDTH / 2),
        y: Math.floor(MAP.HEIGHT / 2)
    }
}

function touchNodes(entity) {
    return {...entity, touched: { ...entity.touched, tail: true, id: true, nodes: true }}
}

function updateGameTimeLeft(room) {
    room.gameTimeLeft -= GAME_TICK_MS;
}

function updateGame(room) {
    updateGameTimeLeft(room);
    spawnFoodEntities(room);
    checkForIntersect(room);
    movePlayerEntities(room);
    renderEntitiesToClients(room);
    untouchedGameEntities(room);
    removeDeadEntities(room);
    markDeadForIdleTimedOutEntities(room);
}

function updateScoreBoard(room) {
    calculateScoresOfPlayers(room);
    renderScoreBoardToClients(room);
}

function updateEntityFromRoom(room, entity) {
    if (room) {
        room.gameEntities = room.gameEntities.map(gameEntity => {
            if (gameEntity.id === entity.id) {
                return { ...gameEntity, ...entity };
            }
            return gameEntity;
        });
    }
}

function countPlayerEntities(room) {
    return room.gameEntities.filter(entity => entity.type === TYPE.PLAYER).length;
}

function startGameLoop(room) {
    if (!room) return;

    const hasActivePlayers = countPlayerEntities(room) > 0;

    function gameTick() {
        if (!hasActivePlayers || room.gameTimeLeft <= 0) {
            stopGameLoop(room.roomId);
            deleteRoom(room);
            console.log(`Room ${roomId} has been removed due to no players.`);
            return;
        }

        updateGame(room);
        room.tickTimeOutId = setTimeout(gameTick, GAME_TICK_MS);
    }

    function scoreBoardTick() {
        if (hasActivePlayers) {
            updateScoreBoard(roomId);
            room.scoreBoardTimeOutId = setTimeout(scoreBoardTick, SCOREBOARD_MS);
        }
    }

    gameTick();
    scoreBoardTick();
}

function stopGameLoop(room) {
    if (room) {
        if (room.tickTimeOutId) {
            clearTimeout(room.tickTimeOutId);
            room.tickTimeOutId = null;
        }
        if (room.scoreBoardTimeOutId) {
            clearTimeout(room.scoreBoardTimeOutId);
            room.scoreBoardTimeOutId = null;
        }
    }
}

app.ws(CHANNEL, (ws, req) => {
    const roomId = req.query.roomId;
    let room = getRoom(roomId);

    if (!room) {
        createRoom(roomId, playerName);
        room = getRoom(roomId);
    }

    console.log('Client connected to room:', roomId, 'IP:', req.ip);
    const refPlayer = createEntity({
        roomId,
        position: getCenterPosition(),
        client: ws,
    });

    renderEverythingToClient(room, ws, refPlayer);
    renderEntitiesToClients(room, {excluding: ws});

    ws.on('message', (data) => {
        try {
            const {player, startGame } = JSON.parse(data);
            let playerUpdated = sanitizeEntity(player, refPlayer);

            if (!playerUpdated) return;

            playerUpdated = updateEntityTimeOut(playerUpdated);
            updateEntityFromRoom(room, playerUpdated);

            if (startGame && !room.gameStarted) {
                room.gameStarted = true;
                startGameLoop(room);
            }
        } catch (err) {
            console.error('Client ' + req.ip);
            console.error(err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from room:', roomId, 'IP:', req.ip);
        if (room) {
            const otherEntities = room.gameEntities.filter(entity => entity.client !== ws);
            if (otherEntities.length <= 0) {
                stopGameLoop(room);
                deleteRoom(room);
                console.log(`Room ${roomId} has been removed due to no players.`);
            }
        }
    });
});