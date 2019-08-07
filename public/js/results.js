var dygraph

function updateDataset() {
	getStrategy();
	let url = '/data/';
	let data = {
		url: getUrl(),
		strategy: getStrategy(),
		metric: getMetric(),
	}
	$.post(url, data, res => {
		renderGraph(JSON.parse(res.results))
	})
}

const cutoffDate = '2019-04-29'
const metrics = {
	'TTI': ['WPT_time_TTI_London', 'WPT_time_TTI_California', 'PSI5_time_TTI'],
	'TFB': ['WPT_time_TFB_London', 'WPT_time_TFB_California'], 
	'TSI': ['WPT_time_TSI_London', 'WPT_time_TSI_California', 'PSI5_time_TSI'], 
	'Bytes': ['WPT_bytes_total_London', 'WPT_bytes_total_California', 'PSI5_bytes_total'], 
	'Scripts': ['PSI5_bytes_scripts'],
	'ODCL': ['PSI5_time_ODCL'],
	'TFCP': ['PSI5_time_FCP'],
	'TFMP': ['PSI5_time_FMP'],
}

getUrl = () => {
	return $('#urls').val()
}

getStrategy = () => {
	return $('#strategies').val()
}

getResolution = () => {
	return $('#resolution').val()
}

getMetric = () => {
	return $('#metrics').val()
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
	let metric = getMetric()
	let headers = `date, `
	let benchmarks = {}
	let maxY = 0
	let maxYValues = {}

	for(let i=0; i<metrics[metric].length; i++) {
		benchmarks[metrics[metric][i]] = {
			sum: 0,
			count: 0,
			mean: 0,
			max: 0,
		}
		headers += metrics[metric][i]
		if(i<metrics[metric].length-1) {
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
		for(let j=0; j<metrics[metric].length; j++) {
			//	...get SQL table column names for mean and sd of metric...
			let meanName = `${metrics[metric][j]}_mean`
			let sdName = `${metrics[metric][j]}_sd`
			let mean = results[i][meanName] ? results[i][meanName] : ''
			let sd = results[i][sdName] ? results[i][sdName] : ''
			if(results[i][meanName] > benchmarks[metrics[metric][j]].max) {
				benchmarks[metrics[metric][j]].max = results[i][meanName]
			}
			//	...look up and concatenate these values to the csv string...
			graphData += `${mean}, ${sd}`
			if(typeof maxYValues[metrics[metric][j]] === 'undefined') {
				maxYValues[metrics[metric][j]] = []
			}
			maxYValues[metrics[metric][j]].push(mean)
			if(mean && moment(results[i].date).isBefore(moment(cutoffDate)) ) {
				benchmarks[metrics[metric][j]].sum += results[i][meanName]
				benchmarks[metrics[metric][j]].count ++
			}
			//	...if this is not the last metric for this date add a comma, else a newline
			if(j<metrics[metric].length-1) {
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

	maxY = maxY * 1.05

	let title = resolution > 1 ? `Rolling ${resolution} day averages` : `Daily averages`

	dygraph = new Dygraph(
		document.getElementById('dygraph-container'),
		graphData,
		{
			title: title,
			errorBars: true,
			sigma: 1.0,
			rollPeriod: resolution,
			valueRange: [0, maxY],
			axes: {
				y: {
					axisLabelFormatter: v => {
						switch(metric) {
							case 'Bytes':
							case 'Scripts':
								return v / 100000 + 'mb'
								break;
							default:
								return v / 1000 + 's'
								break;
						}
					},
					axisLabelWidth: 60
				},
			},
			ylabel: $('#metrics option:selected').html(),
			underlayCallback: (ctx, area, dygraph) => {
				ctx.setLineDash([2, 1])
				for(let property in benchmarks) {
					if(benchmarks[property].sum) {
						let xl = dygraph.toDomCoords(firstDate, benchmarks[property].mean)
						let xr = dygraph.toDomCoords(lastDate, benchmarks[property].mean)
						ctx.strokeStyle = '#E66'
						ctx.beginPath()
						ctx.moveTo(xl[0], xl[1])
						ctx.lineTo(xr[0], xr[1])
						ctx.stroke();
					}
				}
				ctx.beginPath()
				ctx.setLineDash([4, 2])
				let y1 = dygraph.toDomCoords(moment(cutoffDate), 0)
				let y2 = dygraph.toDomCoords(moment(cutoffDate), maxY)
				ctx.strokeStyle = '#E66'
				ctx.moveTo(y1[0], y1[1])
				ctx.lineTo(y2[0], y2[1])
				ctx.stroke();
				ctx.setLineDash([])
			}
		}
	)
}


$(() => {
	updateDataset();

	$('#urls').on('change', () => {
		updateDataset()
	})

	$('#metrics').on('change', () => {
		updateDataset()
	})

	$('#strategies').on('change', () => {
		updateDataset()
	})

	$('#resolution').on('change', () => {
		updateDataset()
	})
})