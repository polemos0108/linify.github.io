// read from master
var lineStep = null;
var numLines = null;
var testLines = null;

self.addEventListener('message', function(e) {
	lineStep = e.data.lineStep;
	numLines = e.data.numLines;
	testLines = e.data.testLines;
	lineMaker(e.data.add, e.data.img, e.data.width, e.data.height);
}, false);

/* line creation */
function lineMaker(add, gray, width, height) {
	// find darkest points then draw best line through point
	for(var i=0; i < numLines; i++) {
		var selection = [0];
		var lum = gray[0];
		
		for(var j=1; j < gray.length; j++) {
			if(gray[j] == lum) {
				selection.push(j);
			}
			if(add) {
				if(gray[j] > lum) { 
					selection = [j];
					lum = gray[j];
				}
			} else {
				if(gray[j] < lum) { 
					selection = [j];
					lum = gray[j];
				}
			}
		}
		
		var point = selection[Math.floor(Math.random() * selection.length)];
		self.postMessage(makeLine(point % width, Math.floor(point/width), gray, width, height, add));
	}
	close();
}

/* take point and image data, return line as tuple */
function makeLine(x, y, img, width, height, add) {
	var tests = [];
	for(var i=0; i < testLines; i++) {
		var slope = (Math.random()-0.5)/(Math.random()-0.5);
		var lum = 0; // luminousity accumulator
		var points = [];
		points.push([x,y]);
		
		// basically Bresenham
		if(slope > 1 || slope < -1) { // swap if steep
			var delX = Math.floor(Math.abs(slope));
			var err = Math.abs(slope) - delX;
			var xx = y;
			var yy = x;
			var wwidth = height;
			var hheight = width;
			var swap = true;
		} else { // not steep
			var delX = Math.floor(Math.abs(1/slope));
			var err = Math.abs(1/slope) - delX;
			var xx = x;
			var yy = y;
			var wwidth = width;
			var hheight = height;
			var swap = false;
		}
		if(slope >= 0) {
			var sign = 1;
		} else {
			var sign = -1;
		}
		
		// go up
		var currX = xx;
		var currY = yy;
		var cErr = 0;
		up:
		while(currY > 0) {
			currY--;
			for(var j=0; j < delX; j++) {
				currX -= sign;
				if(currX < 0 || currX >= wwidth) {
					break up;
				}
				if(swap === false) {
					lum += img[currY * width + currX];
					points.push([currX,currY]);
				} else {
					lum += img[currX * width + currY];
					points.push([currY,currX]);
				}
			}
			cErr += err;
			if(cErr >= 0.5) {
				currX -= sign;
				if(currX < 0 || currX >= wwidth) {
					break up;
				}
				if(swap === false) {
					lum += img[currY * width + currX];
					points.push([currX,currY]);
				} else {
					lum += img[currX * width + currY];
					points.push([currY,currX]);
				}
				cErr -= 1;
			}
		}
		
		// go down
		currX = xx;
		currY = yy;
		cErr = 0;
		down:
		while(currY < hheight) {
			for(var j=0; j < delX; j++) {
				currX += sign;
				if(currX < 0 || currX >= wwidth) {
					break down;
				}
				if(swap === false) {
					lum += img[currY * width + currX];
					points.unshift([currX,currY]);
				} else {
					lum += img[currX * width + currY];
					points.unshift([currY,currX]);
				}
			}
			cErr += err;
			if(cErr >= 0.5) {
				currX += sign;
				if(currX < 0 || currX >= wwidth) {
					break down;
				}
				if(swap === false) {
					lum += img[currY * width + currX];
					points.unshift([currX,currY]);
				} else {
					lum += img[currX * width + currY];
					points.unshift([currY,currX]);
				}
				cErr -= 1;
			}
			currY++;
		}
		tests.push({lum: lum, points: points});
	}
	
	// find best candidate
	if(add) { // additive
		var max = 0; // array position
		var lum = tests[0].lum/tests[0].points.length; // average lum
		for(var i=1; i < tests.length; i++) {
			var testLum = tests[i].lum/tests[i].points.length;
			if(testLum > lum) {
				max = i;
				lum = testLum;
			}
		}
		var line = tests[max].points;
		
		// tick accumulators
		for(var i=0; i < line.length; i++) {
			img[line[i][1] * width + line[i][0]] -= lineStep;
		}
	} else { // subtractive
		var min = 0; // array position
		var lum = tests[0].lum/tests[0].points.length; // average lum
		for(var i=1; i < tests.length; i++) {
			var testLum = tests[i].lum/tests[i].points.length;
			if(testLum < lum) {
				min = i;
				lum = testLum;
			}
		}
		var line = tests[min].points;
		
		// tick accumulators
		for(var i=0; i < line.length; i++) {
			img[line[i][1] * width + line[i][0]] += lineStep;
		}
	}
	return [line[0][0], line[0][1], line[line.length-1][0], line[line.length-1][1]];
}