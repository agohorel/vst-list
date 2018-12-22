
// @TODO don't get/save results the way i am now.
// all we need is the product URLs from requesting the listings pages in an array so we can make a second
// round of requests to the individual product pages, where we can scrape all the relevant fields in one fell swoop

const fs = require("fs");
const request = require("request");
const colors = require("colors");
const jsdom = require("jsdom");
const {JSDOM} = jsdom;

// max no. of items to lookup (each page has 20 results)
// current max is set really low to not be spammy
let max = 200;
let urlList = [];
let dom;
let cooldown = 10000;
let vsts = {};

// insert pages to request until max
for (var i = 0; i < max; i+=20){
	let url = `https://www.kvraudio.com/plugins/windows/macosx/instruments/effects/hosts/free/newest/start${i}`;
	urlList.push(url);
}

urlList.forEach((url, i) => {
	let hasBeenRedirected = false;
	// cooldown to prevent spamminess
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
				// pass dom to getURLs() to parse 
				getURLs(dom);
			}
		});
	}, cooldown * i);
});

function getURLs(dom){
	// get node list containing all product boxes on each page
	let productBoxes = dom.window.document.querySelectorAll(".kvrpboxa");
	let urls = [];

	productBoxes.forEach((product) => {
		let url = product.href;
		urls.push(url);
	});
	// function to fire off second round of requests
}


function getTags(urls){
	let vsts = {}
	// make second round of requests, get tags, build up object, call saveResults()
	urls.forEach((url, i) => {
		setTimeout(() => {
			request(url, (error, response, body) => {
				if (error){
					console.log(`received ${error} on ${url}`.red);
				} else {
					// @TODO figure out how to target these (using jsdom)
					let name = ;
					let author = ;
					let platform = ;
					let description = ;
					vsts[name] = {
						name,
						author,
						platform,
						description
					};
				}
			});
		}, cooldown * i);
	});
	saveResults(vsts);
}

function saveResults(vsts){
	let path = "./vsts.json";
	// check if file exists
	fs.stat(path, (err, stats) => {
		// if not, write file
		if (err || stats === undefined){			
			fs.writeFile(path, JSON.stringify(vsts, null, 2), (err) => {
				if (err) throw err;
				else console.log("saved results to disk.");
			});		
		} else {
			fs.appendFile(path, JSON.stringify(vsts, null, 2), (err) => {
				if (err) throw err;
				else console.log("appended results to disk.");
			});
		}
	});
}