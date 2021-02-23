/* polyfill for canvas.toBlob() from https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob */
if (!HTMLCanvasElement.prototype.toBlob) {
	Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
		value: function (callback, type, quality) {
			var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
				len = binStr.length,
				arr = new Uint8Array(len);
			for (var i=0; i<len; i++ ) {
				arr[i] = binStr.charCodeAt(i);
			}
			callback( new Blob( [arr], {type: type || 'image/png'} ) );
		}
	});
}

function process(img, color, hiRes) {
	ds.style.display = 'none';
	
	if(workers.length != 0) {
		for(var i=0; i<workers.length; i++) {
			workers[i].terminate();
		}
		workers = [];
	}
	
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	if(hiRes) {
		if(img.width > img.height) {
			canvas.width = 1024;
			canvas.height = Math.floor(img.height/img.width * 1024);
		} else {
			canvas.height = 1024;
			canvas.width = Math.floor(img.width/img.height * 1024);
		}
		display.width = canvas.width/2;
		display.height = canvas.height/2;
		lDisplay.width = canvas.width;
		lDisplay.height = canvas.height;
	} else {
		if(img.width > img.height) {
			canvas.width = 512;
			canvas.height = Math.floor(img.height/img.width * 512);
		} else {
			canvas.height = 512;
			canvas.width = Math.floor(img.width/img.height * 512);
		}
		display.width = canvas.width;
		display.height = canvas.height;
		lDisplay.width = canvas.width*2-2;
		lDisplay.height = canvas.height*2-2;
	}
	cWidth = canvas.width;
	cHeight = canvas.height;
	
	if(add) {
		context.fillStyle = '#000000';
	} else {
		context.fillStyle = '#FFFFFF';
	}
	
	context.fillRect(0,0,1024,1024);
	context.drawImage(img,0,0, canvas.width, canvas.height);
	var imageData = context.getImageData(0,0,canvas.width, canvas.height);
	var data = imageData.data;
	
	lines = [];
	linesDrawn = 0;
	
	prepCanvas(hiRes);
	
	if(color === false) {
		totalProgress = numLines;
		var gray = new Int16Array(data.length/4);
		// convert to grayscale
		var total = 0;
		for(var i=0; i < data.length/4; i++) {
			gray[i] = (Math.floor(0.21 * data[i*4] + 0.72 * data[i*4+1] + 0.07 * data[i*4+2])) // grayscale using CIE luminance
			total += gray[i];
		}
		workers.push(new Worker('javascripts/workerv2.js'));
		workers[0].addEventListener('message', drawLineMaker(0,hiRes), false);
		workers[0].postMessage({add: add, lineStep: lineStep, numLines: numLines, testLines: testLines, img: gray, width: imageData.width, height: imageData.height, total: total});

	} else {
		var red = new Int16Array(data.length/4);
		var green = new Int16Array(data.length/4);
		var blue = new Int16Array(data.length/4);
		var rTotal = 0;
		var gTotal = 0;
		var bTotal = 0;
		for(var i=0; i < data.length/4; i++) {
			red[i] = (data[i*4]);
			green[i] = (data[i*4+1]);
			blue[i] = (data[i*4+2]);
			rTotal += red[i];
			gTotal += green[i];
			bTotal += blue[i];
		}
		
		if(!add) {
			rTotal = data.length/4 * 255 - rTotal;
			gTotal = data.length/4 * 255 - gTotal;
			bTotal = data.length/4 * 255 - bTotal;
		}
		
		if(rTotal >= gTotal && rTotal >= bTotal) {
			var rNum = numLines;
			var gNum = Math.floor(numLines * gTotal/rTotal);
			var bNum = Math.floor(numLines * bTotal/rTotal);
		} else if(gTotal >= rTotal && gTotal >= bTotal) {
			var rNum = Math.floor(numLines * rTotal/gTotal);
			var gNum = numLines;
			var bNum = Math.floor(numLines * bTotal/gTotal);
		} else if(bTotal >= rTotal && bTotal >= gTotal) {
			var rNum = Math.floor(numLines * rTotal/bTotal);
			var gNum = Math.floor(numLines * gTotal/bTotal);
			var bNum = numLines;
		}
		
		totalProgress = rNum + gNum + bNum;
		
		workers.push(new Worker('javascripts/workerv2.js'));
		workers[0].addEventListener('message', drawLineMaker(1,hiRes), false);
		workers[0].postMessage({add: add, lineStep: lineStep, numLines: rNum, testLines: testLines, img: red, width: imageData.width, height: imageData.height});
		
		workers.push(new Worker('javascripts/workerv2.js'));
		workers[1].addEventListener('message', drawLineMaker(2,hiRes), false);
		workers[1].postMessage({add: add, lineStep: lineStep, numLines: gNum, testLines: testLines, img: green, width: imageData.width, height: imageData.height});
		
		workers.push(new Worker('javascripts/workerv2.js'));
		workers[2].addEventListener('message', drawLineMaker(3,hiRes), false);
		workers[2].postMessage({add: add, lineStep: lineStep, numLines: bNum, testLines: testLines, img: blue, width: imageData.width, height: imageData.height});
	}
}

/* event handler for line from worker */
function drawLineMaker(color, hiRes) {
	return function(e) {
		linesDrawn++;
		progress.style.width = linesDrawn/totalProgress * 100 + '%';
		switch(color) {
			case 0:
				dContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				lContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				break;
			case 1:
				dContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				lContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				break;
			case 2:
				dContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				lContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				break;
			case 3:
				dContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				lContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				break;
		}
		
		var line = e.data;
		
		if(hiRes) {
			lineToBitsHR(color, line);
			dContext.beginPath();
			dContext.moveTo(line[0]/2 + 0.5, line[1]/2 + 0.5);
			dContext.lineTo(line[2]/2 + 0.5, line[3]/2 + 0.5);
			dContext.stroke();
			
			lContext.beginPath();
			lContext.moveTo(line[0] + 0.5, line[1] + 0.5);
			lContext.lineTo(line[2] + 0.5, line[3] + 0.5);
			lContext.stroke();
		} else {
			lineToBits(color, line);
			dContext.beginPath();
			dContext.moveTo(line[0] + 0.5, line[1] + 0.5);
			dContext.lineTo(line[2] + 0.5, line[3] + 0.5);
			dContext.stroke();
			
			lContext.beginPath();
			lContext.moveTo(line[0]*2, line[1]*2);
			lContext.lineTo(line[2]*2, line[3]*2);
			lContext.stroke();
		}
		if(linesDrawn/totalProgress == 1) {
			finishedDrawing();
		}

	}
}

function finishedDrawing() {
	var bar = document.getElementById('barBack');
	bar.style.visibility = 'hidden';
	
	lines = new Uint8Array(lines); // convert lines to Uint8Array
	
	ds.style.display = 'block';
}

function submitFunc(e) {
	e.preventDefault();
	form[10].innerHTML = '<i class="fa fa-cog fa-spin"></i> Draw!'
	if(form.elements[3].checked === true) {
		add = 1;
	} else {
		add = 0;
	}
	
	numLines = parseInt(form.elements[6].value, 10);
	lineStep = parseInt(form.elements[7].value, 10);
	testLines = parseInt(form.elements[8].value, 10);
	storeSettings();

	if(fileInput.files[0] != undefined) {
		image.src = URL.createObjectURL(fileInput.files[0]);
		cors = true; // in case of error
	} else {
		image.src = form.elements[0].value;
		cors = false;
	}
}

function dLinkFunc(e) {
	e.preventDefault();
	var now = new Date();
	var string = now.toISOString();
	
	lDisplay.toBlob(function(blob) {
		saveAs(blob, 'linify_' + string.slice(0,10) + '_' + string.slice(11,13) + '-' + string.slice(14,16)+ '.png');
	});
}

function sLinkFunc(e) {
	if(shared === false) {
		sLink.innerHTML = '<i class="fa fa-cog fa-spin"></i> Save';
		shared = true;
		lDisplay.toBlob(function(blob) {
			var formData = new FormData();
			formData.append('add', add);
			formData.append('lineStep', lineStep);
			formData.append('width', cWidth);
			formData.append('height', cHeight);
			formData.append('size', blob.size);
			formData.append('image', blob);
			formData.append('lines', new Blob([lines], {type: 'application/octet-stream'}));
			
			var req = new XMLHttpRequest();
			
			req.onreadystatechange = function() {
				if(req.readyState === XMLHttpRequest.DONE) {
					if(req.status === 200) {
						window.location.href = '/' + req.responseText;
					} else {
						shared = false;
						sLink.innerHTML = '<i class="fa fa-cloud-upload></i> Save';
					}
				}
			}
			
			req.open('POST', '/u', true);
			req.send(formData);
		}, 'image/png');
	}
}

function sizeFunc(e) {
	display.style.display = 'none';
	lDisplay.style.display = 'inline';
	size.style.display = 'none';
	rSize.style.display = 'inline-block';
	if(typeof rLink !== 'undefined') {
		prepCanvas(hiRes);
		new reconstructLines(array);
	}
}

function rSizeFunc(e) {
	lDisplay.style.display = 'none';
	display.style.display = 'inline';
	rSize.style.display = 'none';
	size.style.display = 'inline-block';
	if(typeof rLink !== 'undefined') {
		prepCanvas(hiRes);
		new reconstructLines(array);
	}
}

function getInspired() {
	var req = new XMLHttpRequest();
	req.onreadystatechange = function() {
		if(req.readyState === XMLHttpRequest.DONE) {
			if(req.status === 200) {
				try{
					var data = JSON.parse(req.responseText);
					shuffle(data);
					var insp = document.getElementById('insp');
					for(var i=0; i < data.length; i++) {
						var img = new Image();
						img.src = 'http://imgur.com/' + data[i] + 't.png';
						img.className = 'insp';
						var a = document.createElement('a');
						a.href = '/' + data[i];
						a.appendChild(img);
						insp.appendChild(a);
					}
				} catch(err) {
					console.log(err);
				}
			}
		}
	}
	req.open('GET', '/i', true);
	req.send();
}

/* adds line to array as bits */
function lineToBits(color, line) {
	var start = pointToNum(line[0], line[1]);
	lines.push((color << 6) | (start >> 5));
	
	var end = pointToNum(line[2], line[3]);
	lines.push((start << 3) | (end >> 8));
	lines.push(end);
}

function lineToBitsHR(color, line) {
	lines.push(color);
	var start = pointToNum(line[0], line[1]);
	var end = pointToNum(line[2], line[3]);
	lines.push(start >> 4);
	lines.push((start << 4) | (end >> 8));
	lines.push(end);
}

/* take Uint8Array and draw to display */
function reconstructLines(array) {
	playing = true; // prevents replay button from being pressed
	rafID++;
	this.rafID = rafID;
	this.i = 0; // static variable passed through bind
	if(hiRes) {
		this.rate = array.length/24000;
		this.lastTime = performance.now();
		if(display.style.display == 'none') {
			window.requestAnimationFrame(rLineLHR.bind(this, array));
		} else {
			window.requestAnimationFrame(rLineHR.bind(this, array));
		}
	} else {
		this.rate = array.length/18000; // done over 6 seconds
		this.lastTime = performance.now();
		if(display.style.display == 'none') {
			window.requestAnimationFrame(rLineL.bind(this, array));
		} else {
			window.requestAnimationFrame(rLine.bind(this, array));
		}
	}
}

/* helper function for reconstructLines, draw line in array*/
function rLine(array, time) {
	var numDraw = Math.ceil((time - this.lastTime) * this.rate);
	this.lastTime = time;
	for(var j=0; j < numDraw; j++) {
		if(this.i < array.length/3) {
			var color = array[this.i*3] >> 6;
			var start = numToPoint(((array[this.i*3] << 5) | (array[this.i*3+1] >> 3)) & 2047);
			var end = numToPoint(((array[this.i*3+1] << 8) | array[this.i*3+2]) & 2047);
			
			switch(color) {
			case 0:
				dContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				break;
			case 1:
				dContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				break;
			case 2:
				dContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				break;
			case 3:
				dContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				break;
			}
			
			dContext.beginPath();
			dContext.moveTo(start[0]+0.5, start[1]+0.5);
			dContext.lineTo(end[0]+0.5, end[1]+0.5);
			dContext.stroke();
			
			this.i++;
		}
	}
	if(this.i < array.length/3 && rafID == this.rafID) {
		window.requestAnimationFrame(rLine.bind(this, array));
	} else {
		playing = false;
	}
}

function rLineL(array, time) {
	var numDraw = Math.ceil((time - this.lastTime) * this.rate);
	this.lastTime = time;
	for(var j=0; j < numDraw; j++) {
		if(this.i < array.length/3) {
			var color = array[this.i*3] >> 6;
			var start = numToPoint(((array[this.i*3] << 5) | (array[this.i*3+1] >> 3)) & 2047);
			var end = numToPoint(((array[this.i*3+1] << 8) | array[this.i*3+2]) & 2047);
			
			switch(color) {
			case 0:
				lContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				break;
			case 1:
				lContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				break;
			case 2:
				lContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				break;
			case 3:
				lContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				break;
			}
			
			lContext.beginPath();
			lContext.moveTo(start[0]*2, start[1]*2);
			lContext.lineTo(end[0]*2, end[1]*2);
			lContext.stroke();
			
			this.i++;
		}
	}
	if(this.i < array.length/3 && rafID == this.rafID) {
		window.requestAnimationFrame(rLineL.bind(this, array));
	} else {
		playing = false;
	}
}

function rLineHR(array, time) {
	var numDraw = Math.ceil((time - this.lastTime) * this.rate);
	this.lastTime = time;
	for(var j=0; j < numDraw; j++) {
		if(this.i < array.length/4) {
			var color = array[this.i*4];
			var start = numToPoint(((array[this.i*4+1] << 4) | (array[this.i*4+2] >> 4)) & 4095);
			var end = numToPoint(((array[this.i*4+2] << 8) | array[this.i*4+3]) & 4095);
			
			switch(color) {
			case 0:
				dContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				break;
			case 1:
				dContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				break;
			case 2:
				dContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				break;
			case 3:
				dContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				break;
			}
			
			dContext.beginPath();
			dContext.moveTo(start[0]/2+0.5, start[1]/2+0.5);
			dContext.lineTo(end[0]/2+0.5, end[1]/2+0.5);
			dContext.stroke();
			
			this.i++;
		}
	}
	if(this.i < array.length/4 && rafID == this.rafID) {
		window.requestAnimationFrame(rLineHR.bind(this, array));
	} else {
		playing = false;
	}
}

function rLineLHR(array, time) {
	var numDraw = Math.ceil((time - this.lastTime) * this.rate);
	this.lastTime = time;
	for(var j=0; j < numDraw; j++) {
		if(this.i < array.length/4) {
			var color = array[this.i*4];
			var start = numToPoint(((array[this.i*4+1] << 4) | (array[this.i*4+2] >> 4)) & 4095);
			var end = numToPoint(((array[this.i*4+2] << 8) | array[this.i*4+3]) & 4095);
			
			switch(color) {
			case 0:
				lContext.strokeStyle = 'rgba(' + lineStep + ',' + lineStep + ',' + lineStep + ',1)';
				break;
			case 1:
				lContext.strokeStyle = 'rgba(' + lineStep + ',0,0,1)';
				break;
			case 2:
				lContext.strokeStyle = 'rgba(0,' + lineStep + ',0,1)';
				break;
			case 3:
				lContext.strokeStyle = 'rgba(0,0,' + lineStep + ',1)';
				break;
			}
			
			lContext.beginPath();
			lContext.moveTo(start[0], start[1]);
			lContext.lineTo(end[0], end[1]);
			lContext.stroke();
			
			this.i++;
		}
	}
	if(this.i < array.length/4 && rafID == this.rafID) {
		window.requestAnimationFrame(rLineLHR.bind(this, array));
	} else {
		playing = false;
	}
}

/* wipes canvas, fills in background color */
function prepCanvas(hiRes) {
	dContext.clearRect(0,0,display.width, display.height);
	lContext.clearRect(0,0,lDisplay.width, lDisplay.height);
	if(hiRes) {
		dContext.lineWidth = 0.5;
		lContext.lineWidth = 1;
	} else {
		dContext.lineWidth = 1;
		lContext.lineWidth = 2;
	}
	
	if(add) {
		dContext.fillStyle = '#000000';
		dContext.fillRect(0,0,512,512);
		dContext.globalCompositeOperation = 'lighter';
		
		lContext.fillStyle = '#000000';
		lContext.fillRect(0,0,1024,1024);
		lContext.globalCompositeOperation = 'lighter';
	} else {
		dContext.fillStyle = '#FFFFFF';
		dContext.fillRect(0,0,512,512);
		dContext.globalCompositeOperation = 'difference';
		
		lContext.fillStyle = '#FFFFFF';
		lContext.fillRect(0,0,1024,1024);
		lContext.globalCompositeOperation = 'difference';
	}
}

/* tries to store color, add, numLines, lineStep, and testLines */
function storeSettings() {
	try {
		localStorage.setItem('lineStep', lineStep.toString());
		localStorage.setItem('numLines', numLines.toString());
		localStorage.setItem('testLines', testLines.toString());
		localStorage.setItem('add', add.toString());
		if(form.elements[2].checked === true) {
			var color = '1';
		} else {
			var color = '0';
		}
		localStorage.setItem('color', color);
		if(form.elements[9].checked === true) {
			var hiRes = '1';
		} else {
			var hiRes = '0';
		}
		localStorage.setItem('hiRes', hiRes);
	} catch(e) {
		console.log(e);
		return;
	}
}

function getSettings() {
	try {
		if(localStorage.length != 0) {
			document.getElementById('numLines').value = localStorage.getItem('numLines');
			document.getElementById('lineStep').value = localStorage.getItem('lineStep');
			document.getElementById('testLines').value = localStorage.getItem('testLines');
			
			if(parseInt(localStorage.getItem('color'),10)) {
				form.elements[2].checked = true;
			} else {
				form.elements[4].checked = true;
			}
			if(parseInt(localStorage.getItem('add'),10)) {
				form.elements[3].checked = true;
			} else {
				form.elements[5].checked = true;
			}
			if(parseInt(localStorage.getItem('hiRes'),10)) {
				form.elements[9].checked = true;
			}
		}
	} catch(e) {
		console.log(e);
		return;
	}
}

/* takes point, returns number based on clockwise border numeration */
function pointToNum(x, y) {
	var width = cWidth-1;
	var height = cHeight-1;
	if(y == 0) {
		return x;
	}
	if(x == width) {
		return width + y;
	}
	if(y == height) {
		return width*2 + height - x;
	}
	return width*2 + height*2 - y;
}

/* takes number, returns point */
function numToPoint(num) {
	// width height needs fixing
	var width = cWidth;
	var height = cHeight;
	if(num <= width) {
		return [num, 0];
	}
	if(num <= width + height) {
		return [width, num - width];
	}
	if(num <= width*2 + height) {
		return [width*2 + height - num, height];
	}
	return [0, width*2 + height*2 - num];
}

/* Fisher-Yates Shuffle taken from http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array */
function shuffle(array) {
	var currentIndex = array.length, temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
}
