const request = require('request');
const colors = require('colors');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;
let dom;

// max no. of items to lookup (each page has 20 results)
// current max is set really low to not be spammy
let max = 420;
let urlList = [];

// insert pages to request until max
for (var i = 400; i < max; i+=20){
	let url = `https://www.kvraudio.com/plugins/windows/macosx/instruments/effects/hosts/free/newest/start${i}`;
	urlList.push(url);
}

urlList.forEach((url, i) => {
	let hasBeenRedirected = false;
	// 1 sec. cooldown to prevent spamminess
	setTimeout(() => {
		request({ 
			uri: url,
	        followRedirect: (response) => {
	            console.log(`Provided URL ${url} was redirected to: ${response.headers.location}. Cancelling this batch.`.red);
	            hasBeenRedirected = true;
	            return true;
	        }
    	}, (error, response, body) => {
			if (error){
				// print error in red if request fails outright
				console.log(`received ${error} on ${url}`.red);
			} else if (!hasBeenRedirected){
				let status = response.statusCode;
				// print green if OK, red if any sort of error
				if (status >= 200 && status < 300){
					console.log(`received status code ${status} on ${url}`.green);
				} else {
					console.log(`received status code ${status} on ${url}`.red);
				}

				// convert raw body text to dom
				dom = new JSDOM(body);
				// pass dom to constructURLs() to parse 
				constructURLs(dom);
			}
		});
	}, 5000 * i);
});

function constructURLs(dom){
	// get node list containing all product boxes on each page
	let productBoxes = dom.window.document.querySelectorAll(".kvrpboximg");
	let disallowedCharacters = ["{", "}", "|", "\\", "^", "~", "[", "]", "`", " ", ":", "."];
	let productUrlList = [];

	productBoxes.forEach((product) => {
		// get the child nodes of each product box
		let children = product.nextElementSibling.childNodes;
		// break off strings from product's child nodes to get names
		let productName = children[0].textContent;
		let authorName = children[1].childNodes[2].data;

		// replace disallowed characters with hyphens
		disallowedCharacters.forEach((character) => {
			productName = findAndReplace(productName, character, "-");
			authorName = findAndReplace(authorName, character, "-");
		});

		// handle case where 2 disallowed characters occur back to back
		productName = findAndReplace(productName, "--", "-");
		authorName = findAndReplace(authorName, "--", "-");

		// handle possesive s's 
		productName = findAndReplace(productName, "'", "");
		authorName = findAndReplace(authorName, "'", "");

		// concatenate (hopefully) valid URLs
		let url = `https://www.kvraudio.com/product/${productName}${authorName}`;
		
		productUrlList.push(url);
	});
	console.log(productUrlList);

	testURLs(productUrlList);
}

function findAndReplace(string, target, replacement){
	for (let i = 0; i < string.length; i++) {
		string = string.replace(target, replacement);
	}

	return string;
}

function testURLs(urlArray){
	let passed = 0;
	let failed = 0;
	urlArray.forEach((url, i) => {
	// 1 sec. cooldown to prevent spamminess
	setTimeout(() => {
		request({ 
			uri: url,
	        followRedirect: (response) => {
	            console.log(`Provided URL ${url} was redirected to: ${response.headers.location}.`.red);
	            failed++;
	            return true;
	        }
    	}, (error, response, body) => {
				if (error){
					// print error in red if request fails outright
					console.log(`received ${error} on ${url}`.red);
				} else {
					let status = response.statusCode;
					// print green if OK, red if any sort of error
					if (status >= 200 && status < 300){
						console.log(`received status code ${status} on ${url}`.green);
						passed++;
					} else {
						console.log(`received status code ${status} on ${url}`.red);
						failed++;
					}
				}
			});
		}, 1000 * i);
	});

	// @TODO fix this nonsense w/ async/await
	setTimeout(() => {
		console.log(`done checking this batch of URLs. ${passed} URLs passed and ${failed} URLs failed.`);
	}, 1000 * urlArray.length)		
}


