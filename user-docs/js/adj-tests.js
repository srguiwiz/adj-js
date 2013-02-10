//
// Copyright (c) 2002-2013, Nirvana Research
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the copyright holder nor the names of
//       contributors may be used to endorse or promote products derived from
//       this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY DIRECT,
// INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
// EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// i.e. Modified BSD License
//
// ==============================================================================
//
// Idea and first implementation - Leo Baschy <srguiwiz12 AT nrvr DOT com>
//
// ==============================================================================
//
// Comments to: <adj.feedback AT nrvr DOT com>
//
// ==============================================================================
//
// Public repository - https://github.com/srguiwiz/adj-js
//

// in an SVG document being used in a test suite, load this source file after loading adj.js
// e.g.
//   <script type="text/javascript" xlink:href="js/adj.js"/>
//   <script type="text/javascript" xlink:href="js/adj-tests.js"/>
//
// raison d'être of this file is to allow a test suite to iterate through test cases in an iframe,
// specifically to work around newer browsers (Chrome) not allowing access to local files in an iframe,
// use window.postMessage to communicate between test suite HTML document and an iframe with SVG documents being tested

// the singleton
if (typeof AdjTests == "undefined") {
	AdjTests = {};
}

// constant
AdjTests.messageRegexp = /^([^|]*)(?:\|(.*))?$/;

AdjTests.windowReceivesMessage = function windowReceivesMessage(evt) {
	// accept any evt.origin
	var messageCommand;
	var messageParameter;
	var messageMatch = AdjTests.messageRegexp.exec(evt.data);
	if (messageMatch) {
		messageCommand = messageMatch[1];
		messageParameter = messageMatch[2];
	} else {
		messageCommand = "";
	}
	switch (messageCommand) {
		case "load":
			// remove before loading another listener
			window.removeEventListener("message", AdjTests.windowReceivesMessage, false);
			// navigate, load
			window.location.href = messageParameter;
			break;
		case "Adj.doDocAndVerify":
			try {
				// do
				var commandResult = Adj.doDocAndVerify();
				// reply
				evt.source.postMessage("Adj.didDocAndVerify|" + commandResult, "*");
			} catch (exception) {
				exceptionString = exception.toString();
				// reply
				evt.source.postMessage("Adj.didDocAndVerifyException|" + exceptionString, "*");
			}
			break;
		default:
	}
}

// see https://developer.mozilla.org/en-US/docs/DOM/window.postMessage
window.addEventListener("message", AdjTests.windowReceivesMessage, false);
