
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
let max = 20;
let urlList = [];
// let dom;
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
				let dom = new JSDOM(body);
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
		let url = `https://www.kvraudio.com${product.href}`;
		urls.push(url);
	});
	console.log(urls);
	getTags(urls);
}


function getTags(urls){
	let vsts = {}
	// make second round of requests, get tags, build up object, call saveResults()
	urls.forEach((url, i) => {
		setTimeout(() => {
			console.log(url);
			request(url, (error, response, body) => {
				if (error){
					console.log(`received ${error} on ${url}`.red);
				} else {

					// try{
						let dom = new JSDOM(body);
						let detailsBox = dom.window.document.querySelector(".pdetails").children;
						let name = detailsBox[0].children[0].cells[1].textContent;
						let developer = detailsBox[0].children[1].cells[1].textContent;
						
						
						let tagsBox = dom.window.document.querySelector(".pdetails").children[0].children[3].cells[1].children;
						let tags = [];

						for (let i = 0; i < tagsBox.length; i++){
							tags.push(tagsBox[i].textContent);
						}

						let bodySection = dom.window.document.querySelector(".prodbodycon");
						let description = "";

						for (let i = 0; i < bodySection.children.length; i++){
							description += `${bodySection.children[i].textContent}\n`;
						}
						
						let downloadsBox = dom.window.document.querySelectorAll(".pdetails")[2];
						let downloadsBoxLinks = downloadsBox.querySelectorAll("a");
						let downloadLinks = [];
						
						for (let i = 0; i < downloadsBoxLinks.length; i++){
							if (downloadsBoxLinks[i].textContent.toLowerCase() === "downloads" || downloadsBoxLinks[i].textContent.toLowerCase() === "download"){
								downloadLinks.push(downloadsBoxLinks[i].href);
							}
						}

						// @TODO get lists of formats (vst, au, etc) and platforms (win, mac, etc)
						let formats = [];
						let platforms = [];

						vsts[name] = {
							name,
							developer,
							// formats,
							// platforms,
							tags,
							description,
							downloadLinks
						};
						console.log(vsts[name]);
						saveResults(vsts[name]);
					// }

					// catch(e){
						// console.log(e)
					// }
				}
			});
		}, cooldown * i);
	});
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