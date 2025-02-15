window.onload = function () {
  var board = document.getElementById("board")
  var scoreElement = document.getElementById("score")
  var highScoreElement = document.getElementById("highScore")
  var contextFor2D = board.getContext("2d")
  var gameState
  /** approx time in ms to move snake forward one square/update board */
  var updateRate
  var score
  var highScore
  var difficulty
  var snake
  var target
  var nTilesX
  var nTilesY
  /** pixels */
  var tileWidth
  var directionQueue = []
  loadDifficultyPreference()
  loadHighScore(difficulty)
  initGame()
  
  var prevTime = performance.now() // ms since window loaded.

  document.getElementById("settingsButton").addEventListener("click", toggleSettings)
  document.getElementsByName("theme").forEach(element => element.addEventListener("change", changeTheme))
  document.getElementsByName("difficulty").forEach(element => element.addEventListener("change", changeDifficulty))
  document.addEventListener("keydown", handleKeyInput)
  document.addEventListener("touchstart", handleTouchStart)
  document.addEventListener("touchmove", handleTouchMove)
  var xDown = null
  var yDown = null

  var button = document.getElementById("button")
  button.addEventListener("click", buttonHandler)

  function setUpBoardSizes() {
    // set nTilesX, nTilesY, tileSize based on window size
    const xDim = window.innerWidth * 0.9
    const yDim = window.innerHeight * 0.6

    var isLandscape = xDim > yDim

    if (isLandscape) {
      nTilesX = 20
      nTilesY = 15
    } else {
      nTilesX = 15
      nTilesY = 20
    }

    limitedByX = xDim / nTilesX < yDim / nTilesY
    if (limitedByX) {
      var estTileSize = xDim / nTilesX
    } else {
      var estTileSize = yDim / nTilesY
    }
    // must be even because we divide by two to center things
    tileWidth = Math.floor(estTileSize)
    if (tileSize % 2 == 1) {
      tileWidth = tileSize - 1
    }
  }

  function buttonHandler(event) {
    button.blur() // prevent focusing on button so subsequent space doesn't trigger callback twice (thru key and button)
    switch (gameState) {
      case gameStates.LOADED :
        gameState = gameStates.PLAYING
        button.textContent = "Pause"
        window.requestAnimationFrame(updateBoard)
        break
      case gameStates.PLAYING :
        gameState = gameStates.PAUSED
        button.textContent = "Resume"
        break
      case gameStates.PAUSED :
        gameState = gameStates.PLAYING
        button.textContent = "Pause"
        window.requestAnimationFrame(updateBoard)
        break
      case gameStates.FINISHED :
        gameState = gameStates.PLAYING
        button.textContent = "Paused"
        window.requestAnimationFrame(updateBoard)
        break
    }    
  }

  function updateBoard(timeStamp) {
    // consider not wasting CPU cycles
    if (gameState == gameStates.PLAYING && timeStamp - prevTime > updateRate) {
      if (directionQueue.length != 0) {
        snake.dir = directionQueue.shift()
      }
      var nextPosition = snake.getNextPosition()
      if (checkOverlapWithTarget(nextPosition, target)) {
        increaseScore(scoreElement)
        increaseSpeed()
        growOrMoveSnake(nextPosition, true)
        moveTarget(snake)
      } else {
        growOrMoveSnake(nextPosition, false)
      }

      if (snake.checkOverlapWithSelf() || outOfFrame()) {
        gameState = gameStates.FINISHED
        button.textContent = "New Game"
        alert("You lost")
        saveHighScore(difficulty)
        initGame()
        return
      }

      redraw() // draw everything
      prevTime = timeStamp
    }

    window.requestAnimationFrame(updateBoard)
  }
  
  function loadDifficultyPreference() {
    var savedDifficulty = getCookie("difficulty")
    if (savedDifficulty != null) {
      difficulty = savedDifficulty
    } else {
      difficulty = difficulties.EASY
    }
  }

  function loadHighScore(difficulty) {
    var savedHighScore = getCookie("highScore_" + difficulty)
    if (savedHighScore != null) {
      highScore = savedHighScore
    } else {
      highScore = 0
    }
    highScoreElement.innerText = highScore
    document.getElementById("highScoreLabel").innerText = "High Score (" + capitalizeFirstLetter(difficulty) + ") :"
  }

  function capitalizeFirstLetter(string) {
    return string.substring(0, 1).toUpperCase() + string.substring(1)
  }

  function saveHighScore(difficulty){
    if (score > highScore) {
      highScore = score
      highScoreElement.innerText = highScore
      document.cookie = "highScore_" + difficulty + "=" + highScore + "; SameSite=Strict;"
    }
  }

  function initGame() {
    updateRate = 300
    score = 0
    scoreElement.innerText = 0
    setUpBoardSizes()
    board.width = nTilesX * tileSize()
    board.height = nTilesY * tileSize()
    snake = new Snake({i:0, j:0})
    target = getRandomUnoccupiedPosition(snake)
    gameState = gameStates.LOADED
    hideSettings()
  }

  function toggleSettings(event) {
    var settingsPanel = document.getElementById("settings")
    if (settingsPanel.classList.contains("hidden")) {
      settingsPanel.classList.remove("hidden")
      var themes = document.getElementsByName("theme")
      themes.forEach(theme => {
        if (theme.value == getCurrentTheme()) {
          theme.checked = "checked"
        }
      })
      var difficultyOptions = document.getElementsByName("difficulty")
      difficultyOptions.forEach(difficultyOption => {
        if (difficultyOption.value == difficulty) {
          difficultyOption.checked = "checked"
        }
      })
    } else {
      settingsPanel.classList.add("hidden")
    }
  }

  function hideSettings() {
    var settingsPanel = document.getElementById("settings")
    if (!settingsPanel.classList.contains("hidden")) {
      settingsPanel.classList.add("hidden")
    }
  }

  function changeTheme(event) {
    var theme = event.target.value
    changeThemeResource(theme)
    document.cookie = "theme=" + theme + "; SameSite=Strict;"
  }

  function changeDifficulty(event) {
    var newDifficulty = event.target.value
    if (gameState == gameStates.PLAYING || gameState == gameStates.PAUSED) {
      if (confirm("Start new game?")) {
        saveHighScore(difficulty)
        gameState = gameStates.FINISHED
        button.textContent = "New Game"
      } else {
        hideSettings()
        return
      }
    }
    difficulty = newDifficulty
    loadHighScore(difficulty)
    document.cookie = "difficulty=" + difficulty + "; SameSite=Strict;"
    initGame()
  }

  function handleKeyInput(event) {
    const key = event.code
    if (gameState == gameStates.PLAYING) {
      switch (key) {
        case "ArrowUp":
        case "KeyW":
          handleDirectionChange(event, "up")
          break
        case "ArrowDown":
        case "KeyS":
          handleDirectionChange(event, "down")
          break
        case "ArrowRight":
        case "KeyD":
          handleDirectionChange(event, "right")
          break
        case "ArrowLeft":
        case "KeyA":
          handleDirectionChange(event, "left")
          break
      }
    }

    switch(key) {
      case "Space":
      case "KeyP":
        event.preventDefault() // stop pagedown
        buttonHandler()
        break
    }
  }

  function handleTouchStart(event) {
    const firstTouch = event.touches[0]
    xDown = firstTouch.clientX
    yDown = firstTouch.clientY
  };

  /**
   * Modified from
   * https://stackoverflow.com/a/23230280
   * (user "givanse")
   */
  function handleTouchMove(event) {
    if (!xDown || !yDown || gameState != gameStates.PLAYING) {
      return;
    }

    var xUp = event.touches[0].clientX;
    var yUp = event.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff)) { // horizontal component larger
      if (xDiff > 0) {
        /* left swipe */
        handleDirectionChange(event, "left")
      } else {
        /* right swipe */
        handleDirectionChange(event, "right")
      }
    } else {
      if (yDiff > 0) {
        /* up swipe */
        handleDirectionChange(event, "up")
      } else {
        /* down swipe */
        handleDirectionChange(event, "down")
      }
    }
    /* reset values */
    xDown = null;
    yDown = null;
  };

  function handleDirectionChange(event, direction) {
    event.preventDefault() // stop scrolling
    var previousDirection
    if (directionQueue.length == 0) {
      previousDirection = snake.dir
    } else {
      previousDirection = directionQueue[directionQueue.length - 1]
    }
    if (previousDirection != direction && !areOppositeDirections(previousDirection, direction)) {
      queueDirection(direction)
    }
  }

  function areOppositeDirections(direction1, direction2) {
    switch (direction1) {
      case "up":
        return direction2 == "down"
      case "down":
        return direction2 == "up"
      case "right":
        return direction2 == "left"
      case "left":
        return direction2 == "right"
    }
  }

  function queueDirection(direction) {
    directionQueue.push(direction)
  }

  function growOrMoveSnake(nextPosition, ateTarget) {
    if (ateTarget) {
      snake.addToFront(nextPosition)
    } else {
      snake.moveBackToFront(nextPosition)
    }
  }

  function moveTarget(snake) {
    target = getRandomUnoccupiedPosition(snake)
  }

  function redraw() {
    contextFor2D.clearRect(0, 0, board.width, board.height)
    snake.getSegments().forEach(segment => {
      drawCircle(segment, tileSize() / 2 - 1, "#60842e")
    })
    drawEyes(snake, tileSize() / 2 - 1)
    drawCircle(target, tileSize() / 2 - 3, "#a67244")
  }

  // return true if snake overlaps target
  function checkOverlapWithTarget(nextSnakeHead, target) {
    return (nextSnakeHead.i == target.i) && (nextSnakeHead.j == target.j)
  }

  function increaseScore(scoreElement) {
    scoreElement.innerText = ++score
  }

  function increaseSpeed() {
    updateRate = getAcceleration(difficulty) * updateRate
  }

  function getAcceleration(difficulty) {
    var accel = 1
    switch (difficulty) {
      case difficulties.EASY :
        accel = 1
        break
      case difficulties.MEDIUM :
        accel = 0.95
        break
      case difficulties.HARD :
        accel = 0.9
        break
    }
    return accel
  }

  function tileSize() {
    return tileWidth
  }

  /**
   * returns int [0, max - 1]
   */
  function getRandomInt(max) {
    return Math.floor(Math.random() * max)
  }

  function getRandomUnoccupiedPosition(snake) {
    var unoccupiedPositions = []
    for (var col = 0; col < nTilesX; col++) {
      for (var row = 0; row < nTilesY; row++) {
        var isOccupied = false
        for (const segment of snake.getSegments()) {
          if (col === segment.i && row === segment.j) {
            isOccupied = true
            break
          }
        }
        if (!isOccupied) {
          unoccupiedPositions.push({i: col, j: row})
        }
      }
    }
    return unoccupiedPositions[getRandomInt(unoccupiedPositions.length)]
  }
  /**
   * tilePosition: 0-indexed xy tile index
   * returns pixel coords of center of that tile
   */
  function toPixelCoords(tilePosition) {
    return {
      x: (tilePosition.i + 0.5) * tileSize(),
      y: (tilePosition.j + 0.5) * tileSize()
    }
  }

  function outOfFrame() {
    return snake.getHead().i >= nTilesX ||
      snake.getHead().i < 0 ||
      snake.getHead().j >= nTilesY ||
      snake.getHead().j < 0
  }

  function drawCircle(tilePos, radius, color) {
    drawCircleAt(toPixelCoords(tilePos), radius, color)
  }

  function drawCircleAt(coord, radius, color) {
    contextFor2D.beginPath()
    contextFor2D.strokeStyle = color;
    contextFor2D.arc(coord.x, coord.y, radius, 0, 2 * Math.PI)
    contextFor2D.fillStyle = color
    contextFor2D.fill()
    contextFor2D.stroke()
  }

  function drawEyes(snake, headRadius) {
    const headCenter = toPixelCoords(snake.getHead())
    var eyesCoords = getEyeCoordinates(headCenter, headRadius, snake.dir)
    drawCircleAt(eyesCoords[0], headRadius * 0.1, "black")
    drawCircleAt(eyesCoords[1], headRadius * 0.1, "black")
  }

  function getEyeCoordinates(headCenter, headRadius, direction) {
    var ret = []
    switch (direction) {
      case "up" :
        ret[0] = {x: headCenter.x - headRadius * 0.3, y: headCenter.y - headRadius * 0.3}
        ret[1] = {x: headCenter.x + headRadius * 0.3, y: headCenter.y - headRadius * 0.3}
        break
      case "down" :
        ret[0] = {x: headCenter.x - headRadius * 0.3, y: headCenter.y + headRadius * 0.3}
        ret[1] = {x: headCenter.x + headRadius * 0.3, y: headCenter.y + headRadius * 0.3}
        break
      case "left" :
        ret[0] = {x: headCenter.x - headRadius * 0.3, y: headCenter.y - headRadius * 0.3}
        ret[1] = {x: headCenter.x - headRadius * 0.3, y: headCenter.y + headRadius * 0.3}
        break
      case "right" :
        ret[0] = {x: headCenter.x + headRadius * 0.3, y: headCenter.y - headRadius * 0.3}
        ret[1] = {x: headCenter.x + headRadius * 0.3, y: headCenter.y + headRadius * 0.3}
        break
    }
    return ret
  }
}

const difficulties = {
  EASY : "easy",
  MEDIUM : "medium",
  HARD : "hard"
}

const gameStates = {
  LOADED : "loaded", // hasn't started
  PLAYING : "playing",
  PAUSED : "paused",
  FINISHED : "finished" // lost
}

function Snake(pos) {
  this.segments = []
  this.dir = "right"
  this.segments.push(pos)
  return this
}

Snake.prototype.getHead = function () {
  return this.segments[0]
}

Snake.prototype.getSegments = function () {
  return this.segments
}

Snake.prototype.getNextPosition = function () {
  var nextPos = {
    i: this.getHead().i,
    j: this.getHead().j
  }

  switch (this.dir) {
    case "up":
      nextPos.j -= 1
      break
    case "down":
      nextPos.j += 1
      break
    case "right":
      nextPos.i += 1
      break
    case "left":
      nextPos.i -= 1
      break
  }
  return nextPos
}

Snake.prototype.addToFront = function (nextPos) {
  this.segments.unshift(nextPos)
}

Snake.prototype.moveBackToFront = function (nextPos) {
  this.segments.pop()
  this.segments.unshift(nextPos)
}

Snake.prototype.checkOverlapWithSelf = function () {
  for (var n = 1; n < this.segments.length; n++) {
    if ((this.getHead().i == this.segments[n].i) && (this.getHead().j == this.segments[n].j)) {
      return true
    }
  }
  return false
}