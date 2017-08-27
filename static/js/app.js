$(document).foundation();
/*$(document).on("submit", function(ev) {
  ev.preventDefault();
  console.log("Submit for form id "+ev.target.id+" intercepted");
});*/

//http://foundation.zurb.com/forum/posts/37267-foundation-6-abide-trigger-without-submit-button
/*$("#pollform").bind("submit",function(e) {
  e.preventDefault();
  console.log("submit intercepted");
  return false;
});*/
//var elem = new Foundation.Abide($("pollform"), {});

//$('#pollform').foundation('resetForm');
//$('#pollform').foundation('validateForm');
/*$("#pollform").on("forminvalid.zf.abide", function(e,target) {
  console.log("form is invalid");
}).on("formvalid.zf.abide", function(e,target) {
  console.log("form is valid");
  submitPoll();  
});*/


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
    '<div class="answerselection input-group">' +
      '<span class="input-group-label">Answer ' + answernum + '</span>' + 
        '<input id="answer' + answernum + '" class="input-group-field" type="text" placeholder="What is one possible answer?" pattern="pollentry" required/>' +
    '</div>' +
    '<span class="form-error" data-form-error-for="answer' + answernum + '">An answer is required.</span>';
    /*elem.destroy();
    elem = new Foundation.Abide($("pollform"), {});
    $('#pollform').foundation('resetForm');
    $('#pollform').foundation('validateForm');*/
}

function removeAnswer() {
  var answers = document.getElementsByClassName('answerselection');
  if (answers.length > 2) {
    answers[answers.length-1].remove();
  }
}

function vote(pollid) {
  var _xhttp = new XMLHttpRequest();
  //var userid = window.location.pathname.split("/")[2];
  var selection = document.getElementById("voteselection" + pollid);
  _xhttp.onreadystatechange = function(e) {
    console.log(_xhttp.readyState);
    console.log(_xhttp.status);
    if (_xhttp.readyState === 4 && _xhttp.status === 200) {
      document.getElementById("voteContainer" + pollid).innerHTML = "<h3>Your vote has been recorded.  Thank you.</h3>";
    }
  }
  _xhttp.open("PUT", "/api/vote/" + pollid + "/" + selection.options[selection.selectedIndex].value + 
              "/" + location.search);
  _xhttp.setRequestHeader('Content-Type', 'application/json');
  _xhttp.send();
}

function deletePoll(pollid) {
  var _xhttp = new XMLHttpRequest();
  _xhttp.onreadystatechange = function(e) {
    if (_xhttp.readyState === 4 && _xhttp.status === 204) {
      location.reload();
    }
  }
  _xhttp.open("DELETE", "/api/poll/" + pollid + "/" + location.search);
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
  var resultsVisible = document.getElementById("resultsVisible").checked;
  var allowAnonymousVotes = document.getElementById("allowAnonymousVotes").checked;
  _xhttp.onreadystatechange = function(e) {
    if (_xhttp.readyState === 4) {
      if (_xhttp.status === 403) {
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
  _xhttp.send(JSON.stringify({
    "question": question,
    "answers": answers,
    "resultsVisible": Number(resultsVisible),
    "allowAnonymousVotes": Number(allowAnonymousVotes)
  }));
}

function unauthorized() {
  window.location.href = '/';
}

function makeChart(idx, data) {
  var ctx = document.getElementById('myChart' + idx).getContext('2d');
      var poll_labels = [];
      var poll_data = [];
      var bar_colors = [];
      var all_data = [];
      
        for (var i = 0; i < data.answers.length; i++) {
          all_data.push({"label":data.answers[i], "data":data.votes[i],
          "color":["red", "orange", "yellow", "blue", "green", "magenta"][i % 6]});
        }
        for (var i = 0; i < data.answers.length; i++) {
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
        var chartclasses = document.getElementById("chartContainer" + idx).classList;
        if (chartclasses.contains("hide")) {
          chartclasses.remove("hide");
          chartclasses.add("medium-6");
        }
        console.log(chartclasses);
}

function getPolls() {
  //document.getElementById('question').classList;
  var polls = document.getElementsByClassName("pollChart");
  for (var poll of polls) {
    //ensure index and request is in closure
    let index=poll.getAttribute("data-index"), _xhttp=new XMLHttpRequest();
    //make async
    _xhttp.onreadystatechange = function(e) {
      if ( _xhttp.status === 401) {
        unauthorized();
        return;
      }
      if (_xhttp.readyState === 4 && _xhttp.status === 200) {
        var response = JSON.parse(_xhttp.responseText);
        makeChart(index, response);
      }
    }
    _xhttp.open("GET", "/api/poll/" + poll.getAttribute("data-id") + location.search);
    _xhttp.send();
  }
}

//TODO: If statement for this

getPolls();
