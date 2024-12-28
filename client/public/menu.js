
function showStartGameButton() {
    document.getElementById('startGameButton').style.display = 'block';
    document.getElementById('startGameButton').addEventListener('click', startGame);
}

function createRoom() {
    if(document.getElementById('playerNameInput').value === '') {
        alert('Please enter a name');
        return;
    }

    if(document.getElementById('roomIdInput').value === '') {
        alert('Please enter a roomId');
        return;
    }

    var gameScript = document.createElement("script"); 
    gameScript.id = 'gameScript';
    gameScript.src = 'game.js';

    let url =saveRoomId(window.location.href);

    window.history.pushState('Waiting Room', '', url);

    document.head.appendChild(gameScript);
    document.getElementById('playerListGroup').style.display = 'block';
    document.getElementById('createRoomButton').style.display = 'none';
    document.getElementById('instruction').style.display = 'block';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('playerNameInput').disabled = true;
    document.getElementById('roomIdInput').disabled = true;
    document.getElementById('scoreLabel').style.display = 'none';
}

function startGame() {
    document.getElementById('playerListGroup').style.display = 'none';
    document.getElementById('scoreBoardGroup').style.display = 'block';
    document.getElementById('scoreLabel').style.display = 'block';
    document.getElementById('startGameButton').style.display = 'none';
    document.getElementById('entityEffects').style.display = 'block';
    document.getElementById('timeLeftLabel').style.display = 'block';
    startGameLoop(); 
}

function addParametersToUrl({param, value, url}) {
    let newUrl = new URL(url);
    newUrl.searchParams.set(param, value);
    return newUrl;
}

function getParametersValueFromUrl(value) {
    let url = new URL(window.location.href);
    return url.searchParams.get(value);
}

function preserveScore(url) {
    return addParametersToUrl({
        url, 
        param: 'recentScore',
        value: document.getElementById('score').innerText});
}

function restoreScore() {
    const score = getParametersValueFromUrl('recentScore');
    if (score) {
        document.getElementById('score').innerText = score;
    }
}

function tryAgain() {

    if(document.getElementById('playerNameInput').value === '') {
        alert('Please enter a name');
        return;
    }

    let url = savePlayerName(window.location.href);
    url = saveRoomId(url);
    url = addParametersToUrl({
        url, 
        param: 'startGameRightAway',
        value: 'true'});

    window.location.href = url.toString();
}

function returnToMenu() {
     let url= savePlayerName(window.location.href);
     url = saveRoomId(url);
     url = preserveScore(url);
     url = addParametersToUrl({
        url, 
        param: 'startGameRightAway', 
        value:'false'});
    window.location.href = url.toString();
}

function savePlayerName(url) {
    const playerName = document.getElementById('playerNameInput').value;
    return addParametersToUrl({
        url, 
        param: 'playerName', 
        value: playerName});
}

function saveRoomId(url) {
    const roomId = document.getElementById('roomIdInput').value;
    return addParametersToUrl({
        url,
        param: 'roomId',
        value: roomId
    })
}

function restorePlayerName() {
    const playerName = getParametersValueFromUrl('playerName');
    if (playerName) {
        document.getElementById('playerNameInput').value = playerName;
    } else {
        document.getElementById('playerNameInput').value = generateRandomName();
    }
}


function restoreRoomId() {
    const roomId = getParametersValueFromUrl('roomId');
    if(roomId) {
        document.getElementById('roomIdInput').value = roomId;
    } else {
        document.getElementById('roomIdInput').value = generateRandomRoomId();
    }
}

function winner(text) {
    document.getElementById('gameOver').innerText = 'WINNER!\n' + text;
}

function gameOver() {
    document.getElementById('playerNameInput').disabled = false;
    document.getElementById('timeLeftLabel').style.display = 'none';
    document.getElementById('roomIdInput').disabled = false;
    document.getElementById('tryAgainButton').style.display = 'block';
    document.getElementById('returnToMenuButton').style.display = 'block';
    document.getElementById('entityEffects').style.display = 'none';
    document.getElementById('gameOver').innerText = 'GAME OVER!';
}

function startGameRightAway() {
    if (getParametersValueFromUrl('startGameRightAway') === 'true') {
        createRoom();
    }
}

function generateRandomName() {
    const randomName = 'Player' + Math.floor(Math.random() * 1000);
    return randomName;
}

function generateRandomRoomId() {
    const randomRoomId = 'Room' + Math.floor(Math.random() * 1000);
    return randomRoomId;
}

function startup() {
    document.getElementById('entityEffects').style.display = 'none';
    restorePlayerName();
    restoreRoomId();
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('instruction').style.display = 'none';
    document.getElementById('scoreBoardGroup').style.display = 'none';
    document.getElementById('playerListGroup').style.display = 'none';
    document.getElementById('tryAgainButton').style.display = 'none';
    document.getElementById('startGameButton').style.display = 'none';
    document.getElementById('returnToMenuButton').style.display = 'none';
    document.getElementById('createRoomButton').style.display = 'block';
    document.getElementById('createRoomButton').addEventListener('click', createRoom);
    document.getElementById('tryAgainButton').addEventListener('click', tryAgain);
    document.getElementById('returnToMenuButton').addEventListener('click', returnToMenu);
    document.getElementById('timeLeftLabel').style.display = 'none';

    startGameRightAway();
    restoreScore();
}

window.onload = startup;