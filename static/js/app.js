$(document).foundation()

function logout() {
   window.location.href='/auth/logout' + window.location.search;
}

function getHome() {
   window.location.href='/' + window.location.search;
}
function getActivity(userid) {
  window.location.href='/activity/' + userid + window.location.search;
}

function addAnswer() {
  var answernum = document.getElementsByClassName('answerselection').length + 1;
  document.getElementById("voteanswers").innerHTML = document.getElementById("voteanswers").innerHTML +
    '<div class="answerselection"><label>Answer ' + answernum + '</label><input id="answer' + answernum + '" type="text" ' +
    'placeholder="What is one possible answer?" /></div>';
}

function removeAnswer() {
  var answers = document.getElementsByClassName('answerselection');
  if (answers.length > 2) {
    answers[answers.length-1].remove();
  }
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
  var answerelements = document.getElementsByClassName('answerselection');
  var answers = [];
  for (var i = 0; i < answerelements.length; i++) {
    answers.push(answerelements[i].children[1].value);
  }
  var question = document.getElementById('question').value;
  _xhttp.onreadystatechange = function(e) {
    if (_xhttp.readyState === 4) {
      if (_xhttp.status === 401) {
        unauthorized();
        return;
      }
      console.log({
        "question": question,
        "answers": answers
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
    "answers": answers
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
      var all_data = [];
      var response = JSON.parse(_xhttp.responseText);
      if ("answers" in response) {
        for (var i = 0; i < response.answers.length; i++) {
          all_data.push({"label":response.answers[i], "data":response.votes[i],
          "color":["red", "orange", "yellow", "blue", "green", "magenta"][i % 6]});
        }
        all_data.sort(function(a, b) {return b.data - a.data});
        for (var i = 0; i < response.answers.length; i++) {
          poll_labels.push(all_data[i].label);
          poll_data.push(all_data[i].data);
          bar_colors.push(all_data[i].color);
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


if (document.getElementById('myChart')) {
  //crude
  console.log("Sending");
  getPoll();
}
