$(document).foundation()

var answers = 4;

function addAnswer() {
  document.getElementById("voteanswers").innerHTML = document.getElementById("voteanswers").innerHTML +
    
    '<label>Answer 5</label><input id="answer5" type="text" placeholder="What is an answer" />';
}

function vote() {
  var _xhttp = new XMLHttpRequest();
  var userid = window.location.pathname.split("/")[2];
  var selection = document.getElementById("voteselection");
  _xhttp.open("PUT", "/api/vote/" + userid + "/" + selection.options[selection.selectedIndex].value);
  _xhttp.setRequestHeader('Content-Type', 'application/json');
  _xhttp.send();
}

function deletePoll(pollid) {
  var _xhttp = new XMLHttpRequest();
  _xhttp.onreadystatechange = function(e) {
    console.log(_xhttp.readyState);
    console.log(_xhttp.status);
    if (_xhttp.readyState === 4 && _xhttp.status == 204) {
      location.reload();
    }
  }
  _xhttp.open("DELETE", "/api/poll/" + location.search);
  _xhttp.setRequestHeader('Content-Type', 'application/json');
  _xhttp.send();
}

function submitPoll() {
  var _xhttp = new XMLHttpRequest();
  var question = document.getElementById('question').value;
  var answer1 = document.getElementById('answer1').value;
  var answer2 = document.getElementById('answer2').value;
  var answer3 = document.getElementById('answer3').value;
  var answer4 = document.getElementById('answer4').value;
  _xhttp.onreadystatechange = function(e) {
    if (_xhttp.readyState === 4) {
      if (_xhttp.status === 401) {
        unauthorized();
        return;
      }
      console.log({
        "question": question,
        "answers": [answer1, answer2, answer3, answer4]
      });
      location.reload();
    }
  }
  _xhttp.open("POST", "/api/poll" + location.search);
  _xhttp.setRequestHeader('Content-Type', 'application/json');
  console.log(question);
  //make async
  _xhttp.send(JSON.stringify({
    "question": question,
    "answers": [answer1, answer2, answer3, answer4]
  }));
}

function unauthorized() {
  window.location.href = '/';
}

function getPoll() {
  var _xhttp = new XMLHttpRequest();
  document.getElementById('question').classList;
  
  //make async
  _xhttp.onreadystatechange = function(e) {
    if ( _xhttp.status === 401) {
      unauthorized();
      return;
    }
    if (_xhttp.readyState === 4 && _xhttp.status === 200) {
      var ctx = document.getElementById('myChart').getContext('2d');
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
  _xhttp.open("GET", "/api/poll" + location.search);
  _xhttp.send();
}


var polltitle = document.getElementById('polltitle');
if (document.getElementById('myChart')) {
  //crude
  console.log("Sending");
  getPoll();
}
