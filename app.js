const PORT = process.env.PORT || 3000
const ROOT = "/public"

const ecstatic = require("ecstatic")
const app = require("http").createServer(ecstatic({ root: __dirname + ROOT })).listen(PORT)
const io = require("socket.io")(app)

const maxStonesThrown = 16

let gameStarted = false
let activePlayer = null
let stonesThrown = 0

let sockets = {
	"red": null,
	"blue": null,
	"requesting": null
}

let playerNames = {
	"red": null,
	"blue": null
}

let readyFlags = {
	"red": null,
	"blue": null
}

io.on(
	"connection", function(socket) {

		//when a client requests red colour
		socket.on(
			"requestRed", function(name) {
				console.log(name + " requests red")
				//if the client is a player already send a message back
				if (sockets["red"] === socket || sockets["blue"] === socket) {
					console.log("this socket is already either red or blue")
					socket.emit("message", "You are already a player.")
					
				//if the red player slot is open, set it to that client's socket, emit their name, disable their text field
				} else if (sockets["red"] === null) {
					sockets["red"] = socket
					readyFlags["red"] = true
					playerNames["red"] = name
					io.emit("redPlayerName", playerNames["red"])
					socket.emit("disableTextField")
					console.log(name + " is now red player")
					
					//if no blue player has yet connected, message
					if (sockets["blue"] === null) {
						socket.emit("message", "You have connected as red player. The game will begin when someone connects as blue player.")
						socket.broadcast.emit("message", name + " has connected as red player.")
					
					//if a blue player has already joined, begin the game, red goes first
					} else {
						gameStarted = true
						activePlayer = sockets["red"]
						io.emit("newTurn", stonesThrown)
						socket.emit("message", "You have connected as red player. The game will now begin.")
						socket.broadcast.emit("message", name + " has connected as red player. The game will now begin.")
					}
				} else {
					console.log("red player is already claimed")
					socket.emit("message", "Somebody has already claimed red.")
					
				}
			}
		)
		
		//same as request red
		socket.on(
			"requestBlue", function(name) {
				console.log(name + " requests blue")
				if (sockets["red"] === socket || sockets["blue"] === socket) {
					console.log("this socket is already either red or blue")
					socket.emit("message", "You are already a player.")
					
				} else if (sockets["blue"] === null) {
					sockets["blue"] = socket
					readyFlags["blue"] = true
					playerNames["blue"] = name
					io.emit("bluePlayerName", playerNames["blue"])
					socket.emit("disableTextField")
					console.log(name + " is now blue player")
					if (sockets["red"] === null) {
						socket.emit("message", "You have connected as blue player. The game will begin when someone connects as red player.")
						socket.broadcast.emit("message", name + " has connected as blue player.")
					} else {
						gameStarted = true
						activePlayer = sockets["red"]
						io.emit("newTurn", stonesThrown)
						socket.emit("message", "You have connected as blue player. The game will now begin.")
						socket.broadcast.emit("message", name + " has connected as blue player. The game will now begin.")
					}
				} else {
					console.log("blue player is already claimed")
					socket.emit("message", "Somebody has already claimed blue.")
					
				}
			}
		)
		
		//when the server recieves movement from the active player, send it back to all clients and wait for both players to be ready for the new turn
		socket.on(
			"movementToServer", function(data) {
				if (socket === activePlayer) {
					stonesThrown++
					readyFlags["red"] = false
					readyFlags["blue"] = false
					
					console.log("movement recieved from client: " + data + "\n\t" + stonesThrown + " stones have been thrown")
					dataObj = {vector: JSON.parse(data), stoneIndex: (stonesThrown - 1)}
					io.emit("movementToClients", JSON.stringify(dataObj))
				}
			}
		)
		
		//when both players are ready, and send the signal to begin a new turn, or if 16 stones have been thrown, restart the game
		socket.on(
			"ready", function() {
				
				if (sockets["red"] === socket) {
					readyFlags["red"] = true
				} else if (sockets["blue"] === socket) {
					readyFlags["blue"] = true
				}
				
				if (readyFlags["red"] && readyFlags["blue"]) {
					if (stonesThrown >= maxStonesThrown) {
						io.emit("message", "The game has ended, after 30 seconds the game will reset.")
						setTimeout(resetGame, 30000)
					} else {
						if (activePlayer === sockets["red"]) {
							activePlayer = sockets["blue"]
						} else {
							activePlayer = sockets["red"]
						}
						console.log("starting new turn")
						io.emit("newTurn", stonesThrown)
					}
				}
				
			}
		)
		
		socket.on("requestDisconnect", function() {handleDisconnect(socket)})
		socket.on("disconnect", function() {handleDisconnect(socket)})
		
		//when the server recieves game info, send if to the requesting client
		socket.on(
			"gameInfoToServer", function(data) {
				sockets["requesting"].emit("gameInfoToClient", data)
				sockets["requesting"] = null
			}
		)
		
		//the following checks if the game has started and if it has it tries to request game data from one of the main players
		if (gameStarted) {
			if (sockets["requesting"] === null) {
				sockets["requesting"] = socket
				
				console.log(readyFlags["red"] + " " + readyFlags["blue"])
				
				if (readyFlags["red"]) {
					sockets["red"].emit("requestGameInfo")
					socket.emit("message", "Game info has been requested.")
				}
				else if (readyFlags["blue"]) {
					sockets["blue"].emit("requestGameInfo")
					socket.emit("message", "Game info has been requested.")
				}
				else {socket.emit("message", "Game data cannot be requested right now, please reload the page")}
				
			} else {
				socket.emit("message", "Someone else is requesting game data, please reload the page to try again.")
			}
			
		} else {socket.emit("message", "Welcome, to join the game use the interface above (red goes first).")}
		
		//send playernames to client
		socket.emit("redPlayerName", playerNames["red"])
		socket.emit("bluePlayerName", playerNames["blue"])
	}
)

//this function is called when a player wants to disconnect
function handleDisconnect(socket) {
	
	console.log("someone wants to disconnect")
	
	//if the socket is the red player, set the red socket and name to null, and ready flag to false
	if (sockets["red"] === socket) {
		console.log("red player disconnects")
		sockets["red"] = null
		readyFlags["red"] = false
		playerNames["red"] = null
		io.emit("redPlayerName", playerNames["red"])
		
		if (gameStarted) {
			//if the game has started and the final remaining player has disconnected, reset the game
			if (sockets["blue"] === null) {
				resetGame()
			} else {
				//emit messages, start timer for reset, and enable the player that disconnected's text field
				socket.broadcast.emit("message", "The red player has disconnected. If no new red player connects within 10 seconds, the game will restart and all players will be disconnected.")
				socket.emit("message", "You have disconnected. If no new red player connects within 10 seconds, the game will restart and all players will be disconnected.")
				socket.emit("enableTextField")
				setTimeout(handleResetTimer, 10000)
			}
			
		} else {
			//if game hasnt started, just enable text field and send message
			socket.emit("message", "You have disconnected.")
			socket.emit("enableTextField")
		}
		
	//same as red
	} else if (sockets["blue"] === socket) {
		console.log("blue player disconnects")
		sockets["blue"] = null
		readyFlags["blue"] = false
		playerNames["blue"] = null
		io.emit("bluePlayerName", playerNames["blue"])
		
		if (gameStarted) {
			if (sockets["red"] === null) {
				resetGame()
			} else {
				socket.broadcast.emit("message", "The blue player has disconnected. If no new blue player connects within 10 seconds, the game will restart and all players will be disconnected.")
				socket.emit("message", "You have disconnected. If no new blue player connects within 10 seconds, the game will restart and all players will be disconnected.")
				socket.emit("enableTextField")
				setTimeout(handleResetTimer, 10000)
			}
			
		} else {
			socket.emit("message", "You have disconnected.")
			socket.emit("enableTextField")
		}
		
	//if a the socket was requesting game data set the variable to null
	} else if (sockets["requesting"] === socket){
		sockets["requesting"] = null
	
	//send message if client isnt a player
	} else{
		console.log("this socket isnt a player")
		socket.emit("message", "You cannot disconnect, you are not a player.")
		
	}
	
}

//this function tests a disconnected player is still disconnected
function handleResetTimer() {
	if (gameStarted) {
		if (sockets["red"] === null || sockets["blue"] === null) {
			resetGame()
		}
	}
}

//this function resets server game data to default state
function resetGame() {
	io.emit("enableTextField")
	console.log("messaging clients to reset the game")
	gameStarted = false
	activePlayer = null
	stonesThrown = 0

	let sockets = {
		"red": null,
		"blue": null,
		"requesting": null
	}

	let playerNames = {
		"red": null,
		"blue": null
	}

	let readyFlags = {
		"red": null,
		"blue": null
	}
	io.emit("message", "All players are disconnected, the game has reset.")
	io.emit("resetGame")
}


console.log("visit: http://localhost:3000/assignment3.html")
console.log("ctrl + c to stop")