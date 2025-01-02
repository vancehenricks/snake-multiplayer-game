const GAME_TICK_MS = 50;
const DEFAULT_ENTITY_SIZE = 5;
const MAX_TAIL = 50;
const MAX_PLAYERS_PER_ROOM = 12;
const DEFAULT_IDLE_SPEED = 5;
const IDLE_TIMEOUT_MS = 30000;
const DEFAULT_GAME_TIME_MS = 120000;
const DEFAULT_INVULNERABLE_TIMEOUT_MS = 34000;
const RESPAWN_INVULNERABLE_TIMEOUT_MS = 5000;
const DELAY_START_GAME_MS = 3000;
const MAX_FOOD = 10;
const MAX_OBSTACLE = 10;
const MAX_UNSIGNED_16_BIT = 65535;
const MAP = {
    WIDTH: 600,
    HEIGHT: 600

}
const TYPE = {
    PLAYER: 0,
    FOOD: 1,
    OBSTACLE: 2
}

const STATUS = {
    ALIVE: 0,
    DEAD: 1
}

const PAYLOAD_INDEX = {
    TYPE : 0,
    ID: 1,
    NAME: 2,
    SIZE: 3,
    SCORE: 4,
    TAIL: 5,
    DIRECTION: 8,
    INVULNERABLE: 10,
    TIMEOUT: 11,
    STATUS: 12,
    NODES: 13,
    SCORE_BOARD: 13+MAX_TAIL,
    END: 13+MAX_TAIL+MAX_PLAYERS_PER_ROOM,
}


const PAYLOAD_PROPERTIES = {
    TYPE: 'type',
    ID: 'id',
    NAME: 'name',
    SIZE: 'size',
    SCORE: 'score',
    TAIL: 'tail',
    DIRECTION: 'direction',
    INVULNERABLE: 'invulnerable',
    TIMEOUT: 'timeout',
    STATUS: 'status',
    NODES: 'nodes',
    SCORE_BOARD: 'scoreBoard',
}

const SCORE_ID = {
    ID: 0,
    NAME: 1,
    SCORE: 2,
    DATE: 3,
}

const SCORE_PROPERTIES = [
    'id',
    'name',
    'score',
    'date',
]

const CHANNEL = '/game';

var http = require('http')
const express = require('express');
var expressWs = require('express-ws');
require('dotenv').config();

var app = express();
var server = http.createServer(app)
var expressWs = expressWs(app, server);

const path = require('path');

app.use(express.static(path.join(__dirname, 'client/public')));

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'client/public', 'index.html'));
});

server.listen(process.env.PORT)

console.log('Server listening on port:', process.env.PORT);

function convertNodesTo1DArray(nodes) {
    return nodes.map(node => [node.x, node.y]).flat();
}

function convertObjectTo1DArray(obj) {
    return Object.values(obj).flat();
}


function generateEntityProperties(entity) {
    let updatedEntity = {};
    Object.keys(entity.touched).forEach((property) => {

        if (property === PAYLOAD_PROPERTIES.NODES) {
            updatedEntity = {
                ...updatedEntity,
                nodes: convertNodesTo1DArray(entity.nodes)
            }
        } else {
            updatedEntity = {
                ...updatedEntity,
                [property]: entity[property]
            }
        }
    })

    return updatedEntity;
}

function isTouchedEmpty(entity) {
    return Object.keys(entity?.touched).length > 0;
}

function getPlayerEntities(room) {
    return [...room.gameEntities].filter(entity => entity.type === TYPE.PLAYER);
}

function renderTouchedEntitiesToClient(room) {

    const touchedEntities = [...room.gameEntities].filter(gameEntity =>
        isTouchedEmpty(gameEntity)
    );

    const unusedPropertiesRemoved = touchedEntities.map(entity => generateEntityProperties(entity));
    
    if(unusedPropertiesRemoved.length > 0) {
        getPlayerEntities(room).forEach((entity) => {
            const client = getClient(entity);

            let data = {
                entities: unusedPropertiesRemoved,
             };

            if(entity.touched.score) {
                data = {...data, scoreBoard: room.scoreBoard};
            }

            sendData(client, data);
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

function sendReadyToClients(room, player) {
    getPlayerEntities(room).forEach((entity) => {
        if (entity.id === player.id) return;
        const client = getClient(entity);
        sendData(client, {readyList: room.readyList});
    })  
}

function renderEverythingToClients(room, player) {

    getPlayerEntities(room).forEach((entity) => {
        const client = getClient(entity);

        let data = {};

        if (entity.id === player.id) {
            data = { playerId: player.id };
        }

        sendData(client, {...data, entities: room.gameEntities, creatorId: room.creatorId, readyList: room.readyList});
    })
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

function isValidRoomId ({roomId}) {
    if(!roomId) return false; 
    if(roomId.length > 12) return false;
    if(!new RegExp(/^\w+$/).test(roomId)) return false;
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

    if (!entity || !refEntity) return null;

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

let count = 0;

function generateId() {
    if (count > MAX_UNSIGNED_16_BIT) {
        count = 0;
    } else {
        count += 1;
    }
    return count;
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
let clients = {};

function createClient(entity, client) {
    clients[entity.id] = client
}

function deleteClient(entity) {
    delete clients[entity.id];
}

function getClient(entity) {
    return clients[entity.id];
}

function createGameTime({
    timeout=Date.now(),
    maxMs=DEFAULT_GAME_TIME_MS,
}={}) {
    return {
        timeout,
        maxMs,
    }
}


function createRoom(roomId, entity) {
    rooms[roomId] = {
        roomId,
        gameEntities: [],
        scoreBoard: [],
        tickTimeOutId: null,
        scoreBoardTimeOutId: null,
        gameTime: null,
        creatorId: entity.id,
        gameStarted: false,
        singlePlayer: false,
        readyList: [],
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

function removePlayerFromRoom(room, entity) {
    if (room) {
        room.gameEntities = [...room.gameEntities].filter(gameEntity =>  gameEntity.id !== entity.id);
    }
}

function createEntity({
    type=TYPE.PLAYER,
    id=generateId(),
    position=generateRandomPosition(),
    name='Player',
    size=DEFAULT_ENTITY_SIZE,
    score=0,
    tail=createTail({current: 0, max: 4}),
    direction=generateRandomDirection(),
    invulnerable=createInvulnerableState(),
    timeout=Date.now(),
    status=STATUS.ALIVE}={}) {

    const nodes = [createNode(position)];
    const touched=touchAllProperties();

    const entity = {type, name, id, size, nodes, score, direction, invulnerable, tail, status, timeout, touched};

    return entity;
}

function foodEntitiesCount(room) {
    return room ? room.gameEntities.filter((entity) => entity.type === TYPE.FOOD).length : 0;
}

function obstacleEntitiesCount(room) {
    return room ? room.gameEntities.filter((entity) => entity.type === TYPE.OBSTACLE).length : 0;
}


function generateRandomRange(min, max) {
    return Math.floor((Math.random() * (max - min + 1)) + min);
}

function generatePositionFarFromPlayers(room) {
    const playerEntities = getPlayerEntities(room);

    let position = generateRandomPosition();

    playerEntities.forEach((entity) => {
        const {x, y} = entity.nodes[0];
        const offset = 30;

        if (position.x < x + offset &&
            position.x > x - offset &&
            position.y < y + offset &&
            position.y > y - offset) {
            position = generateRandomPosition();
        }
    });

    return position;
}

 function spawnFoodEntities(room) {
    if (!room || foodEntitiesCount(room) > MAX_FOOD) return;

    const score = generateRandomRange(1, 3);
    const food = createEntity({
        type: TYPE.FOOD,
        name: 'Food',
        tail: createTail({current: 0, max: 0}),
        size: DEFAULT_ENTITY_SIZE + score / .9,
        position: generatePositionFarFromPlayers(room),
        direction: createNode({x: 0, y: 0}),
        score,
    });

    addEntityToRoom(room, food);
}

function spawnObstacleEntities(room) {
    if (!room || obstacleEntitiesCount(room) > MAX_OBSTACLE) return;

    const score = generateRandomRange(3, 5);
    const obstacle = createEntity({
        type: TYPE.OBSTACLE,
        name: 'Obstacle',
        tail: createTail({current: 0, max: 0}),
        size: DEFAULT_ENTITY_SIZE + score / .9,
        position: generatePositionFarFromPlayers(room),
        direction: createNode({x: 0, y: 0}),
        score,
    });

    addEntityToRoom(room, obstacle);
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

function stopWhenOutOfBounds(entity) {
    const {x, y} = entity.nodes[0];
    const offset = entity.size*1.5;

    if(x < offset || x > MAP.WIDTH-offset || y < offset || y > MAP.HEIGHT-offset) {

        if(entity.type === TYPE.PLAYER) {
            //console.log(`Player ${entity.name} killed by world border`);
            return respawnEntity(entity);
        }

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

    const maxTail = entity.tail.max <= MAX_TAIL ? entity.tail.max + score : entity.tail.max;

    return {...entity, tail: {...entity.tail, max: maxTail},
    score: entity.score + score, touched: {id: true, tail: true, score: true}};
}

function killEntity(entity) {
    return {...entity, status: STATUS.DEAD, touched: {id: true, status: true,}};
}

function respawnEntity(entity) {
    const newEntity = createEntity({
        id: entity.id,
        name: entity.name,
        position: getCenterPosition(),
        invulnerable: createInvulnerableState({
            timeout: Date.now(),
            maxMs: RESPAWN_INVULNERABLE_TIMEOUT_MS,
        }),
    });

    return newEntity;
}

function intersectPlayerToPlayer({entity, gameEntity, hits}) {
    if (isEntitySelf(entity, gameEntity) || entity.type !== TYPE.PLAYER || 
     gameEntity.type !== TYPE.PLAYER) return entity;

    if(hasHitTailNode2(hits) || hasHitHeadNode(hits)) {
        //console.log(`Player ${entity.name} killed by player ${gameEntity.name}`);
        return respawnEntity(entity);
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

function intersectPlayerToObstacle({entity, gameEntity, hits}) {
    if(entity.type === TYPE.PLAYER && gameEntity.type === TYPE.OBSTACLE && hasHitHeadNode(hits)) {

        if (isInvulnerableTimedOut(entity)) {
            //console.log(`Player ${entity.name} killed by obstacle`);
            return respawnEntity(entity);
        }
        
        return addScoreToEntity(entity, gameEntity.score);
    }

    return entity;
}

function intersectObstacleToPlayer({entity, gameEntity, hits}) {

    if(entity.type === TYPE.OBSTACLE && gameEntity.type === TYPE.PLAYER && hasHitHeadNode(hits)) {
        return killEntity(entity);
    }
    return entity;
}


function intersectSelf({entity, gameEntity, hits}) {
    if (!isEntitySelf(entity, gameEntity) || 
        entity.type !== TYPE.PLAYER ||
        gameEntity.type !== TYPE.PLAYER) return entity;

    if(hasHitTailNode2(hits)) {
        //console.log(`Player ${entity.name} killed by its own tail`);
        return respawnEntity(entity);
    }

    return entity;
}

function isIdleTimedOut(entity) {
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

function isGameTimedOut({gameTime}) {
    if(Date.now() - gameTime.timeout > gameTime.maxMs) {
        return true;
    }
    return false;
}

function markDeadWhenTimedOut(room) {
    room.gameEntities = [...room.gameEntities].map((entity) => {
        if(isIdleTimedOut(entity) || isGameTimedOut(room)) {
            return killEntity(entity);
        }
        return entity;
    });
}

function removeDeadEntities(room) {
    room.gameEntities = [...room.gameEntities].filter((entity) => {
        if(entity.status === STATUS.DEAD) {
            if (entity.type === TYPE.PLAYER) {
                const client = getClient(entity);
                if(client) {
                    deleteClient(entity);
                    console.log('Closing client IP:', client._socket.remoteAddress);
                    
                    if (isGameTimedOut(room)) {
                        client.close(4004, 'Game timedout');
                    } else {
                        client.close(4001, 'Entity timedout');
                    }
                }
            }
            return false;
        }
        return true;
    });

    const playerCount = playerEntitiesCount(room);
    
    if (playerCount <= 1 && !room.singlePlayer || playerCount <= 0 && room.singlePlayer) {
        getPlayerEntities(room).forEach((entity) => {
            const client = getClient(entity);
            client.close(4004, 'Game timedout');
        });
    }
}

function checkForIntersect(room) {
    const entities = [...room.gameEntities];
    entities.forEach((entity) => {
        let updatedEntity = stopWhenOutOfBounds(entity);
        entities.forEach((gameEntity) => {
            const hits = hasIntersect(updatedEntity, gameEntity);
            updatedEntity = intersectPlayerToFood({entity: updatedEntity, gameEntity, hits});
            updatedEntity = intersectFoodToPlayer({entity: updatedEntity, gameEntity, hits});
            updatedEntity = intersectObstacleToPlayer({entity: updatedEntity, gameEntity, hits});
            updatedEntity = intersectPlayerToObstacle({entity: updatedEntity, gameEntity, hits});
            
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
    room.scoreBoard = initialScoreBoard.sort((a, b) => b.score - a.score);
}

function removeInScoreBoard(room, scoreEntry) {
    return [...room.scoreBoard].filter((entry) => entry.id !== scoreEntry.id);
}

function calculateScoresOfPlayers(room) {
    [...room.gameEntities].forEach((entity) => {
        if(entity.type === TYPE.PLAYER) {
             const scoreEntry = createScoreEntry({...entity});
            sortEntryToScoreBoard(room, scoreEntry);
        }
    });
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

function updateGame(room) {
    spawnFoodEntities(room);
    spawnObstacleEntities(room);
    checkForIntersect(room);
    movePlayerEntities(room);
    calculateScoresOfPlayers(room);
    renderTouchedEntitiesToClient(room);
    untouchedGameEntities(room);
    removeDeadEntities(room);
    markDeadWhenTimedOut(room);
}


function updateEntityFromRoom(room, entity) {
    if (room) {
        room.gameEntities = 
        [...room.gameEntities].map(gameEntity => {
            if (gameEntity.id === entity.id) {
                return { ...gameEntity, ...entity };
            }
            return gameEntity;
        });
    }
}

function playerEntitiesCount(room) {
    return [...room.gameEntities].filter(entity => entity.type === TYPE.PLAYER).length;
}

function startGameLoop(room) {
    if (!room) return;

    room.gameStarted = true;
    room.singlePlayer = playerEntitiesCount(room) === 1;
    room.gameTime = createGameTime();
    renderGameStatesToClient(room);

    const hasActivePlayers = playerEntitiesCount(room) > 0;

    function gameTick() {
        if (!hasActivePlayers) {
            stopGameLoop(room);
            deleteRoom(room);
            console.log(`Room ${room.roomId} has been removed due to no players.`);
            return;
        }

        updateGame(room);

        room.tickTimeOutId = setTimeout(gameTick, GAME_TICK_MS);
    }

    gameTick();
}

function stopGameLoop(room) {
    room.gameStarted = false;

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

function deleteAllClients(room) {
    [...room.gameEntities].forEach((entity) => deleteClient(entity));
}

function renderGameStatesToClient(room) {
    getPlayerEntities(room).forEach((entity) => {
        const client = getClient(entity);

        sendData(client, {
                gameStarted: true, 
                gameTime: room.gameTime, 
        });
    });
};

function addEntityToReadyList(room, entity) {
    const alreadyExist = [...room.readyList].some(entityId => entityId === entity.id);

    if (alreadyExist) return;
    room.readyList = [...room.readyList, entity.id];
}

function removeEntityToReadyList(room, entity) {
    room.readyList = [...room.readyList].filter(entityId => entityId
        !== entity.id);
}

function readyListMatchesCurrentPlayers(room) {
    return room.readyList.length === playerEntitiesCount(room);
};

function sanitizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    
    return undefined;
}

function sendData(client, data) {
    let buffer;
    if (Buffer.isBuffer(data)) {
        buffer = Buffer.alloc(data.length);
    } else {
        buffer = JSON.stringify(data);
    }
    client?.send(buffer);
}

app.ws(CHANNEL, (ws, req) => {
    const roomId = req.query.roomId;
    const playerName = req.query.playerName;

    console.log('Joining room:', req.query.roomId, 'from ', req.ip);

    if (!isValidRoomId({roomId})) {
        console.log('Invalid roomId:', roomId);
        ws.close(4000, 'Invalid roomId given');
        return;
    }
     
    
    if(!isValidName({name: playerName})) {
        console.log('Invalid playerName:', playerName);
        ws.close(4002, 'Invalid playerName given');
        return;
    }

    let room = getRoom(roomId);

    if (room && playerEntitiesCount(room) >= MAX_PLAYERS_PER_ROOM) {
        console.log('Room is full:', roomId);
        ws.close(4005, 'Room is full');
        return
    }

    const refPlayer = createEntity({
        name: playerName,
        position: getCenterPosition(),
    });

    if (!room) {
        console.log('Found none, Creating ', req.query.roomId, ' room setting IP:', req.ip, ' as creator');
        createRoom(roomId, refPlayer);
        room = getRoom(roomId);
    } else if (room.gameStarted) {
        console.log('Game already started in room:', roomId);
        ws.close(4003, 'Game already started');
        return;
    }

    createClient(refPlayer, ws);
    addEntityToRoom(room, refPlayer);

    if (room.creatorId === refPlayer.id) {
        addEntityToReadyList(room, refPlayer);
    }
    renderEverythingToClients(room, refPlayer);

    console.log('Client connected to room:', roomId, 'IP:', req.ip);

    ws.on('message', (data) => {
        try {
            const {player, startGame: sg, ready: ry} = JSON.parse(data);

            let startGame = sanitizeBoolean(sg);
            let ready = sanitizeBoolean(ry);
            let playerUpdated = sanitizeEntity(player, refPlayer);

            if (playerUpdated) {

                playerUpdated = updateEntityTimeOut(playerUpdated);
                updateEntityFromRoom(room, playerUpdated);
            }

            if (ready) {
                addEntityToReadyList(room, refPlayer);
                sendReadyToClients(room, refPlayer);
            } else if (ready === false) { //do not remove if undefined
                removeEntityToReadyList(room, refPlayer);
                sendReadyToClients(room, refPlayer);
            }

            if (startGame && refPlayer.id === room.creatorId && !room.gameStarted && readyListMatchesCurrentPlayers(room)) {
                setTimeout(() => startGameLoop(room), DELAY_START_GAME_MS);
            }
                
        } catch (err) {
            console.error(err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from room:', roomId, 'IP:', req.ip);

        if (!room) return;
        const playerCount = playerEntitiesCount(room);
        
        if (playerCount <= 1 || !room.gameStarted && refPlayer.id === room.creatorId) {
            stopGameLoop(room);
            deleteRoom(room);
            deleteAllClients(room);
            console.log(`Room ${roomId} has been removed due to no players.`);
        } else {
            removePlayerFromRoom(room, refPlayer);
            renderEverythingToClients(room, refPlayer);
        }
    });
});