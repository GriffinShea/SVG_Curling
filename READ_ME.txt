Author: 	Griffin Shea

Description:	This project was submitted as an assignment for COMP2406 - Fundementals of
		Web Design, in November 2018. The goal was to create a multiplayer browser
		based curling game using node.js and websockets technology. I decided to
		impliment the graphics using Scalable Vector Graphics (SVG). Collision is not
		implemented because I ran out of time. Application was created and tested
		with Windows 10 and Google Chrome.

Node version:		v8.12.0

Instructions:
		1. Make sure compatable node.js version is installed.
		2. Open command prompt in this folder and run "npm install socket.io --save"
		   and "npm install --save ecstatic".
		3. Launch server with "node app.js".
		4. Visit https://localhost:3000/assignment3.html in two browsers, enter name
		   in the text field, and click Join Red and Join Blue buttons in both
		   browsers.
		5. In order to throw a stone, click the stone and pull down.

Issues:
	Game will desync when tabbed out.
	Server may randomly emit newTurn twice in a row (don't know why).