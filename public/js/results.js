var dygraph

function updateDataset() {
	getStrategy();
	let url = '/data/';
	let data = {
		url: getUrl(),
		strategy: getStrategy(),
	}
	$.post(url, data, res => {
		renderGraph(JSON.parse(res.results))
	})
}

const cutoffDate = '2019-04-29'
let metrics = ['PSI5_time_TTI', 'WPT_time_TTI_London', 'WPT_time_TTI_California']


getUrl = () => {
	return $('#urls').val()
}

getStrategy = () => {
	return $('#strategies').val()
}

getResolution = () => {
	return $('#resolution').val()
}

setMaxY = (maxYValues, resolution) => {
	let overallMax = 0
	for(metric in maxYValues) {
		let rollingAvgMax = 0
		for(let i=0; i<maxYValues[metric].length; i++) {
			let rollingAvg = 0
			for(let j=i; j>i-resolution; j--) {
				if(maxYValues[metric][j]) {
					rollingAvg += maxYValues[metric][j]
				}
			}
			rollingAvg = rollingAvg / resolution
			console.log(rollingAvg)
			if(rollingAvg > rollingAvgMax) {
				rollingAvgMax = rollingAvg
			}
		}
		if(rollingAvgMax > overallMax) {
			overallMax = rollingAvgMax
		}
	}
	return overallMax
}

renderGraph = results => {
	console.log(results)
	if(dygraph) {
		dygraph.destroy()
	}
	let url = getUrl()
	let strategy = getStrategy()
	let resolution = getResolution()
	let headers = `date, `
	let benchmarks = {}
	let maxY = 0
	let maxYValues = {}

	for(let i=0; i<metrics.length; i++) {
		benchmarks[metrics[i]] = {
			sum: 0,
			count: 0,
			mean: 0,
			max: 0,
		}
		headers += metrics[i]
		if(i<metrics.length-1) {
			headers += ', '
		}
	}

	//	Concatenate data to plot into a csv string with header row
	let graphData = `${headers}\n`
	let firstDate, lastDate

	//	Iterate entire result set...
	for(let i=0; i<results.length; i++) {
		if(!firstDate || moment(results[i].date).isBefore(moment(firstDate))) {
			firstDate = moment(results[i].date)
		}
		if(!lastDate || moment(lastDate).isBefore(moment(results[i].date))) {
			lastDate = moment(results[i].date)
		}

		//	...concatenate the date of result to the csv string...
		graphData += `${results[i].date}, `
		//	...then iterate metrics being plotted...
		for(let j=0; j<metrics.length; j++) {
			//	...get SQL table column names for mean and sd of metric...
			let meanName = `${metrics[j]}_mean`
			let sdName = `${metrics[j]}_sd`
			let mean = results[i][meanName] ? results[i][meanName] : ''
			let sd = results[i][sdName] ? results[i][sdName] : ''
			if(results[i][meanName] > benchmarks[metrics[j]].max) {
				benchmarks[metrics[j]].max = results[i][meanName]
			}
			//	...look up and concatenate these values to the csv string...
			graphData += `${mean}, ${sd}`
			if(typeof maxYValues[metrics[j]] === 'undefined') {
				maxYValues[metrics[j]] = []
			}
			maxYValues[metrics[j]].push(mean)
			if(mean && moment(results[i].date).isBefore(moment(cutoffDate)) ) {
				benchmarks[metrics[j]].sum += results[i][meanName]
				benchmarks[metrics[j]].count ++
			}
			//	...if this is not the last metric for this date add a comma, else a newline
			if(j<metrics.length-1) {
				graphData += ', '
			} else {
				graphData += '\n'
			}
		}
	}

	maxY = setMaxY(maxYValues, resolution)

	for(let property in benchmarks) {
		if(benchmarks[property].sum) {
			benchmarks[property].mean = benchmarks[property].sum / benchmarks[property].count
		}
	}

	console.log(benchmarks)

	maxY = maxY * 1.05

	let title = resolution > 1 ? `Rolling ${resolution} day averages` : `Daily averages`

	dygraph = new Dygraph(
		document.getElementById('dygraph-container'),
		graphData,
		{
			title: title,
			errorBars: true,
			rollPeriod: resolution,
			valueRange: [0, maxY],
			underlayCallback: (ctx, area, dygraph) => {
				for(let property in benchmarks) {
					if(benchmarks[property].sum) {
						let xl = dygraph.toDomCoords(firstDate, benchmarks[property].mean)
						let xr = dygraph.toDomCoords(lastDate, benchmarks[property].mean)
						ctx.strokeStyle = '#D88'
						ctx.beginPath()
						ctx.moveTo(xl[0], xl[1])
						ctx.lineTo(xr[0], xr[1])
						ctx.closePath();
						ctx.stroke();
					}
				}
			}
		}
	)
}


$(() => {
	updateDataset();
})