const socket = io("http://" + window.document.location.host)
let redPlayerName = null
let bluePlayerName = null
let textField = document.getElementById("textField")
let stones = []
let animateFlag = false
let mouseDownX, mouseDownY

//the following constants and variables are used in the SVG
const WIDTH = 600
const HEIGHT = WIDTH
const VIEW_1_WIDTH = WIDTH * 2 / 3
const VIEW_2_WIDTH = WIDTH / 3
const HOG_LINE_Y = VIEW_2_WIDTH / 2 * 3
const STONE_RADIUS = WIDTH / 20

const LINESTROKE = {
	color: "#222222",
	width: 4
}

let draw = SVG("svg").size(WIDTH, HEIGHT)
draw.viewbox(0, 0, WIDTH, HEIGHT)

//background bits of the curling rink, these are drawn the same everytime
let background = draw.rect(WIDTH, HEIGHT).fill("#eeeeee")
let view1Circle1 = draw.circle(VIEW_1_WIDTH / 10 * 8).fill("#009999").move(VIEW_1_WIDTH / 10 * 1, 0)
let view1Circle2 = draw.circle(VIEW_1_WIDTH / 10 * 5).fill("#eeeeee").move(VIEW_1_WIDTH / 10 * 2.5, VIEW_1_WIDTH / 10 * 1.5)
let view1Circle3 = draw.circle(VIEW_1_WIDTH / 10 * 3).fill("#990000").move(VIEW_1_WIDTH / 10 * 3.5, VIEW_1_WIDTH / 10 * 2.5)
let view1Circle4 = draw.circle(VIEW_1_WIDTH / 10 * 1).fill("#eeeeee").move(VIEW_1_WIDTH / 10 * 4.5, VIEW_1_WIDTH / 10 * 3.5)

let view2Circle1 = draw.circle(VIEW_1_WIDTH / 20 * 8).fill("#009999").move((VIEW_1_WIDTH / 20) + VIEW_1_WIDTH, 0)
let view2Circle2 = draw.circle(VIEW_1_WIDTH / 20 * 5).fill("#eeeeee").move((VIEW_1_WIDTH / 20 * 2.5) + VIEW_1_WIDTH, VIEW_1_WIDTH / 20 * 1.5)
let view2Circle3 = draw.circle(VIEW_1_WIDTH / 20 * 3).fill("#990000").move((VIEW_1_WIDTH / 20 * 3.5) + VIEW_1_WIDTH, VIEW_1_WIDTH / 20 * 2.5)
let view2Circle4 = draw.circle(VIEW_1_WIDTH / 20 * 1).fill("#eeeeee").move((VIEW_1_WIDTH / 20 * 4.5) + VIEW_1_WIDTH, VIEW_1_WIDTH / 20 * 3.5)

let seperatorLine = draw.line(VIEW_1_WIDTH, 0, VIEW_1_WIDTH, HEIGHT)
seperatorLine.stroke(LINESTROKE)
let hogLine = draw.line(VIEW_1_WIDTH, HOG_LINE_Y, WIDTH, HOG_LINE_Y)
hogLine.stroke(LINESTROKE)

//these variables will be used later
let redNameText = draw.text("")
redNameText.move(0, HEIGHT / 5 * 4).font({size: 48, fill: "#990000", family: "Inconsolata"})
let blueNameText = draw.text("")
blueNameText.move(VIEW_1_WIDTH / 4 * 3, HEIGHT / 5 * 4).font({size: 48, fill: "#009999", family: "Inconsolata"})


//this function renders any changes to svg elements each animation frame
function render() {
	
	if (redPlayerName != null) {redNameText.text(redPlayerName)}
	else {redNameText.text("")}
	
	if (bluePlayerName != null) {blueNameText.text(bluePlayerName)}
	else {blueNameText.text("")}
	
	
	for (stone of stones) {
		stone.circle.move(stone.x, stone.y)
		stone.bigCircle.move((stone.x - VIEW_1_WIDTH) * 2, stone.y * 2)
	}
}

//this function updates the state of the game, namely the location of stones and whether they should be visible
function update(deltaTime) {
	if (animateFlag) {
		let movementFlag = false
		for (stone of stones) {
			if (stone.vel > 0) {
				movementFlag = true
				stone.y += stone.vel * Math.sin(stone.dir) * deltaTime
				stone.x += stone.vel * Math.cos(stone.dir) * deltaTime
				stone.vel -= 10 * deltaTime
				if (stone.y < 0 || stone.y + STONE_RADIUS > HEIGHT || stone.x + STONE_RADIUS > WIDTH || stone.x < VIEW_1_WIDTH) {
					stone.vel = 0
					stone.circle.hide()
						stone.bigCircle.hide()
				}
				if (stone.vel < 0) {
					stone.vel = 0
					if (stone.y > HOG_LINE_Y) {
						stone.circle.hide()
						stone.bigCircle.hide()
					}
				}
			}
		}
		//if no stones were moved, send the ready to the server to start a new turn
		if (movementFlag === false) {
			console.log("======================ready===================")
			socket.emit("ready")
			animateFlag = false
		}
	}
}

//applies a new movement vector to a stone
function applyVectorToStone(vector, index) {
	stones[index].vel = vector.vel
	stones[index].dir = vector.dir
}

//sets the game up for a new turn
function newTurn(stoneIndex) {
	//every other turn is a blue stone
	let colour = "#cc3333"
	if (stoneIndex % 2 === 1) {
		colour = "#33cccc"
	}
	
	let newStone = {
		x: VIEW_1_WIDTH + (VIEW_2_WIDTH - STONE_RADIUS) / 2,
		y: HEIGHT - HEIGHT / 10,
		vel: 0,
		dir: 0,
		colour: colour,
		circle: draw.circle(STONE_RADIUS).fill(colour).move(VIEW_1_WIDTH + STONE_RADIUS / 2, HEIGHT - HEIGHT / 10)
	}
	newStone.bigCircle = draw.circle(STONE_RADIUS * 2).fill(newStone.colour).move(((VIEW_1_WIDTH + (VIEW_2_WIDTH - STONE_RADIUS * 2) / 2) - VIEW_1_WIDTH) * 2, HEIGHT - HEIGHT / 10 * 2)
	
	stones.push(newStone)
	
	//add the handler for the mouse interaction with this stone
	stones[stones.length - 1].circle.on("mousedown", handleMouseDown)
	
	return "new turn begun"
}

//resets the game to default state
function resetGame() {
	for (stone of stones) {
		stone.circle.remove()
		stone.bigCircle.remove()
	}
	stones = []
	redPlayerName = null
	bluePlayerName = null
}

//mouse down handler saves the position of the mouse and adds the mouse up handler
function handleMouseDown(e) {
	mouseDownX = e.screenX
	mouseDownY = e.screenY
	stones[stones.length - 1].circle.off("mousedown", handleMouseDown)
	document.addEventListener("mouseup", handleMouseUp)
}

//mouse up handler finds the delta of the mouse position with its position on mouse down, calculates the movement vector to be applied and sends it to the server
function handleMouseUp(e) {
	let dMouseX = mouseDownX - e.screenX
	let dMouseY = mouseDownY - e.screenY
	let velocity = Math.sqrt(dMouseX * dMouseX + dMouseY *dMouseY)
	let angle = Math.atan2(dMouseY, dMouseX)
	let vector = {vel: velocity, dir: angle}
	socket.emit("movementToServer", JSON.stringify(vector))
	console.log("velocity: " + velocity + "\nangle: " + angle)
	document.removeEventListener("mouseup", handleMouseUp)
}



//socket listeners

//when movement is recieved, apply the vector to the newest stone, allow the game to update animation
socket.on(
	"movementToClients", function(data) {
		dataObj = JSON.parse(data)
		applyVectorToStone(dataObj.vector, dataObj.stoneIndex)
		stones[stones.length - 1].circle.off("mousedown", handleMouseDown)
		animateFlag = true
	}
)

//when the server asks for game data, send it
socket.on(
	"requestGameInfo", function() {
		let gameInfo = {
			redName: redPlayerName,
			blueName: bluePlayerName,
			stonesArray: []
		}
		for (stone of stones) {
			let newStone = {
				x: stone.x,
				y: stone.y,
				colour: stone.colour,
				visible: stone.circle.visible()
			}
			gameInfo.stonesArray.push(newStone)
		}
		socket.emit("gameInfoToServer", JSON.stringify(gameInfo))
	}
)

//when the game recieves game data, translate it into the game variables
socket.on(
	"gameInfoToClient", function(data) {
		for (stone of stones) {
			stone.circle.remove()
			stone.bigCircle.remove()
		}
		stones = []
		let gameInfo = JSON.parse(data)
		redPlayerName = gameInfo.redName
		bluePlayerName = gameInfo.blueName
		for (stone of gameInfo.stonesArray) {
			let newStone = {
				x: stone.x,
				y: stone.y,
				colour: stone.colour,
				vel: 0,
				dir: 0,
				circle: draw.circle(STONE_RADIUS).fill(stone.colour).move(stone.x, stone.y)
			}
			newStone.bigCircle = draw.circle(STONE_RADIUS * 2).fill(newStone.colour).move((newStone.x - VIEW_1_WIDTH) * 2, newStone.y * 2)
	
			//if that stone was hidden, hide it
			console.log(stone.visible)
			if (!stone.visible) {
				newStone.circle.hide()
				newStone.bigCircle.hide()
				}
			stones.push(newStone)
		}
	}
)

//simple socket actions
socket.on("newTurn", function(stonesThrown) {console.log(newTurn(stonesThrown))})
socket.on("resetGame", resetGame)

socket.on("enableTextField", function() {textField.disabled = false})
socket.on("disableTextField", function() {textField.disabled = true})

socket.on("message", function(message) {document.getElementById("messageArea").innerHTML = message})

socket.on("redPlayerName", function(name) {redPlayerName = name})
socket.on("bluePlayerName", function(name) {bluePlayerName = name})

//button handlers
function handleJoinRed() {socket.emit("requestRed", textField.value)}
function handleJoinBlue() {socket.emit("requestBlue", textField.value)}
function handleDisconnect() {socket.emit("requestDisconnect")}

//the following allows the game to update and render over time
//nearly completely copied from https://css-tricks.com/pong-svg-js/
var lastTime, animFrame

function callback(ms) {
  // we get passed a timestamp in milliseconds
  // we use it to determine how much time has passed since the last call
  if (lastTime) {
    update((ms-lastTime)/1000) // call update and pass delta time in seconds
	render()
  }

  lastTime = ms
  animFrame = requestAnimationFrame(callback)
}


callback()
