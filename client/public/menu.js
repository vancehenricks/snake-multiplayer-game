
function startGame() {
    if(document.getElementById('playerNameInput').value === '') {
        alert('Please enter a name');
        return;
    }

    var gameScript = document.createElement("script"); 
    gameScript.id = 'gameScript';
    gameScript.src = 'game.js';

    document.head.appendChild(gameScript);
    document.getElementById('startButton').style.display = 'none';
    document.getElementById('instruction').style.display = 'block';
    document.getElementById('entityEffects').style.display = 'block';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('scoreBoardGroup').style.display = 'block';
    document.getElementById('playerNameInput').disabled = true;
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
    url = addParametersToUrl({
        url, 
        param: 'startGameRightAway',
        value: 'true'});

    window.location.href = url.toString();
}

function returnToMenu() {
     let url= savePlayerName(window.location.href);
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

function restorePlayerName() {
    const playerName = getParametersValueFromUrl('playerName');
    if (playerName) {
        document.getElementById('playerNameInput').value = playerName;
    } else {
        document.getElementById('playerNameInput').value = generateRandomName();
    }
}

function gameOver() {
    document.getElementById('playerNameInput').disabled = false;
    document.getElementById('tryAgainButton').style.display = 'block';
    document.getElementById('returnToMenuButton').style.display = 'block';
    document.getElementById('entityEffects').style.display = 'none';
    document.getElementById('gameOver').innerText = 'GAME OVER!';
}

function startGameRightAway() {
    if (getParametersValueFromUrl('startGameRightAway') === 'true') {
        startGame();
    }
}

function generateRandomName() {
    const randomName = 'Player' + Math.floor(Math.random() * 1000);
    return randomName;

}

function startup() {
    document.getElementById('entityEffects').style.display = 'none';
    restorePlayerName();
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('instruction').style.display = 'none';
    document.getElementById('scoreBoardGroup').style.display = 'none';
    document.getElementById('tryAgainButton').style.display = 'none';
    document.getElementById('returnToMenuButton').style.display = 'none';
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('tryAgainButton').addEventListener('click', tryAgain);
    document.getElementById('returnToMenuButton').addEventListener('click', returnToMenu);

    startGameRightAway();
    restoreScore();
}

window.onload = startup;