'use strict';

const	express 		= require('express'),
			dotenv			=	require('dotenv'),
			mysql				=	require('mysql'),
			bodyParser	=	require('body-parser'),
			app					=	express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));

dotenv.config({path: '.env'});

const connection = mysql.createConnection({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASS,
	database: process.env.MYSQL_DB,
});
connection.connect();


app.get('/', (req, res) => {
	let queryString = `SELECT * FROM tb_summaries_daily WHERE url_id = 20 AND strategy = 1`
	connection.query(queryString, (err, results, fields) => {
		if(err) throw err;
		results = JSON.stringify(results);
		res.render('index', {results: results});
	})
});

app.post('/data/', (req, res) => {
	console.log(`${JSON.stringify(req.body)}`);
	let queryString = `SELECT * FROM tb_summaries_daily WHERE url_id = ${req.body.url} AND strategy = ${req.body.strategy}`
	connection.query(queryString, (err, results, fields) => {
		if(err) throw err;
		results = JSON.stringify(results);
		res.send({ results: results })
	})
});


app.listen(process.env.PORT, process.env.IP, () => {
	console.log("Server started...");
});
