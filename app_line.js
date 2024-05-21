const PORT = 3500;
const express = require("express");
const line = require("@line/bot-sdk");
require("dotenv").config();
const app = express();

app.set("view engine", "ejs");

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

app.use("/tasks", require("./routes/tasks_test.js"));

app.use("/addTask", require("./routes/addTask.js"));

app.use("/", require("./routes/index.js"));

app.use("/test", async (req,res,next) => {

	const { MySQLClient } = require("./lib/database/client.js");

	var data;

	try {
		data = await MySQLClient.executeQuery('SELECT * FROM todolist');
		console.log(data);
	} catch (err) {
		next(err);
	}

	res.end("OK");

});

// LINE Bot SDK が提供するミドルウェアを挟み込み、リクエストヘッダの署名検証や JSON パースなどを任せてしまう
app.post('/webhook', line.middleware(config), (req, res) => {
  // 1回のリクエストに複数のメッセージが含まれていたりすることもあるので
  // イベントの配列を1件ずつ取得して処理してやる
  const events = req.body.events;
  const arrayEvents = Object.keys(events[0]);
  console.log(events[0]);
  console.log(typeof(events));
  console.log(arrayEvents);
  console.log(typeof(arrayEvents));
  Promise.all(events.map((event) => {
    // イベント1件を処理する・エラー時も例外を伝播しないようにしておく
    return handleEvent(event).catch(() => { return null; });
  })
    .then((result) => {
      // 全てのイベントの処理が終わったら LINE API サーバには 200 を返す
      res.status(200).json({}).end();
    }));
});

/**
 * イベント1件を処理する
 * 
 * @param {*} event イベント
 * @return {Promise} テキストメッセージイベントの場合は client.pushMessage() の結果、それ以外は null
 */
function handleEvent(event) {
  // メッセージイベントではない場合、テキスト以外のメッセージの場合は何も処理しない
  if(event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  
  const reqMessage = event.message.text;

  console.log(reqMessage.slice(0,2));

  if(reqMessage.slice(0,3) === "登録　") {
	const { MySQLClient } = require("./lib/database/client.js");

        Promise.all([
        	MySQLClient.executeQuery(
          	`insert into todolist(name,note) values("${reqMessage.slice(3)}",'happily')`
          	 )
        ]).then((results) =>{
		console.log("インサート成功");
	})

	  .catch((err) =>{
                next(err);
        });
	return;
  }

    if(reqMessage.slice(0,3) === "削除　") {
        const { MySQLClient } = require("./lib/database/client.js");

        Promise.all([
                MySQLClient.executeQuery(
                `delete from todolist where name = "${reqMessage.slice(3)}" `
                 )
        ]).then((results) =>{
                console.log("デリーと成功");
        })

          .catch((err) =>{
                next(err);
        });
        return;
  }

  if(reqMessage.slice(0,3) === "表示　"){
	const { MySQLClient } = require("./lib/database/client.js");
	var tasks;
	Promise.all([
		 MySQLClient.executeQuery(
		"select name from todolist"
		)
	]).then((results) =>{
		tasks = results[0];
		var taskArray = [];

		for (var i = 0; i < tasks.length; i++){
			taskArray.push(tasks[i].name);
		}

		taskStr = taskArray.join('\n');

		const replyTasks = {
			type: 'text',
			text: taskStr
		};
		console.log(`tasks: ${taskStr}`);
		return client.replyMessage(event.replyToken, replyTasks);
	})
	  .catch((err) =>{
		console.log(err);
	//	next(err);
	  });
	  return;
  }

  // 返信用メッセージを組み立てる : ユーザからのメッセージにカギカッコを付けて返信してみる
  const echoMessage = {
    type: 'text',
    text: `「${event.message.text}」`
  };
  
  // Reply API を利用してリプライする
  return client.replyMessage(event.replyToken, echoMessage);
  // Push API を利用する場合は以下のようにする
  // return client.pushMessage(event.source.userId, echoMessage);
}

app.listen(PORT, () => {
	console.log(`Application listening at ${PORT}`);
});

