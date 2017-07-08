$(document).foundation()

function addAnswer() {
  document.getElementById("vote").innerHTML = document.getElementById("vote").innerHTML +
    '<div class="grid-x grid-padding-x"><div class="large-12 cell">' +
    '<label>Answer 5</label><input id="answer5" type="text" placeholder="What is an answer" />' +
    '</div></div>';
}

function submitPoll() {
  var _xhttp = new XMLHttpRequest();
  var question = document.getElementById('question').value;
  var answer1 = document.getElementById('answer1').value;
  var answer2 = document.getElementById('answer2').value;
  var answer3 = document.getElementById('answer3').value;
  var answer4 = document.getElementById('answer4').value;
  _xhttp.open("POST", "/api/poll" + location.search, false);
  _xhttp.setRequestHeader('Content-Type', 'application/json');
  console.log(question);
  //make async
  _xhttp.send(JSON.stringify({
    "question": question,
    "answers": [answer1, answer2, answer3, answer4]
  }));
  if (_xhttp.status === 401) {
      unauthorized();
      return;
  }
  console.log({
    "question": question,
    "answers": [answer1, answer2, answer3, answer4]
  });
  getPoll();
}

function unauthorized() {
  window.location.href = '/';
}

function getPoll() {
  var _xhttp = new XMLHttpRequest();
  document.getElementById('question').classList;
  _xhttp.open("GET", "/api/poll" + location.search, false);
  //make async
  _xhttp.onreadystatechange = function(e) {
    if ( _xhttp.status === 401) {
      unauthorized();
      return;
    }
    if (_xhttp.readyState === 4 && _xhttp.status === 200) {
      var poll_labels = [];
      var poll_data = [];
      var bar_colors = [];
      var response = JSON.parse(_xhttp.responseText);
      if ("answers" in response) {
        for (var i = 0; i < response.answers.length; i++) {
          poll_labels.push(response.answers[i]);
          poll_data.push(response.votes[i]);
          bar_colors.push(["red", "orange", "blue", "yellow", "green"][i % 5]);
        }
        var myDoughnutChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: poll_labels,
            datasets: [{
              label: "My First dataset",
              backgroundColor: bar_colors,
              borderColor: 'rgb(255, 99, 132)',
              data: poll_data,
            }]
          }, //JSON.parse(xhttp.responseText),
          options: {}
        });
        polltitle.innerText = response.question;
        var chartclasses = document.getElementById("chartContainer").classList;
        var questionclasses = document.getElementById("settingsContainer").classList;
        if (chartclasses.contains("hide")) {
          chartclasses.remove("hide");
          chartclasses.add("medium-6");
        }
        console.log(chartclasses);
        console.log(questionclasses);
      }

      
    }
  }
  _xhttp.send();
}

var ctx = document.getElementById('myChart').getContext('2d');
var polltitle = document.getElementById('polltitle');
console.log(location.search);
if (location.search) {
  //crude
  console.log("Sending");
  getPoll();
}
