//
// Simplified BSD License
//
// Copyright (c) 2016, Nirvana Research
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// ==============================================================================
//
// Idea and first implementation - Leo Baschy <srguiwiz12 AT nrvr DOT com>
//
// ==============================================================================
//
// Project contact: <adj.project AT nrvr DOT com>
//
// ==============================================================================
//
// Public repository - https://github.com/srguiwiz/adj-js

// An auxiliary function for an HTML table of contents.
//
// Made to transition from using Amaya.

function makeTableOfContents() {
  var startLevel = "h2"; // e.g. don't list the only h1 heading the whole document
  var createIds = false; // for permanent links false, and insert ids manually
  var sl = parseInt(startLevel.substring(1)) - 1;
  var hs = document.querySelectorAll(["h1","h2","h3","h4","h5","h6"].slice(sl).join(","));
  var hns = [0];
  var ntoc = document.createElement("ul");
  var toc = ntoc;
  for (var i = 0, n = hs.length; i < n; i++) {
    var h = hs[i];
    if (createIds && !h.getAttribute("id")) {
      do {
        var newId = "L" + Math.ceil(99998 * Math.random() + 1);
      } while (document.getElementById(newId));
      h.setAttribute("id", newId);
    }
    var l = parseInt(h.tagName.substring(1)) - sl;
    l = Math.min(l, hns.length + 1); // in case a level has been skipped, e.g. an h3 followed by an h5
    if (hns.length < l) {
      while (hns.length < l) {
        hns.push(1);
        var ul = document.createElement("ul");
        toc.lastElementChild.appendChild(ul);
        toc = ul;
      }
    } else {
      if (l < hns.length) {
        while (l < hns.length) {
          hns.pop();
          toc = toc.parentNode.parentNode;
        }
      }
      hns[l-1]++;
    }
    var p = hns.join(".") + ".";
    h.innerText = p + " " + h.innerText.replace(/^[0-9][0-9.]+\s+/, "");
    var li = document.createElement("li");
    var id = h.getAttribute("id");
    if (id && h.isEqualNode(document.querySelectorAll("*[id='"+id+"']")[0])) {
      var a = document.createElement("a");
      a.innerText = h.innerText;
      a.setAttribute("href", "#" + h.getAttribute("id"));
      li.appendChild(a);
    } else {
      li.innerText = h.innerText;
    }
    toc.appendChild(li);
    //console.log(sl, l, hns, p, h);
  }
  try {
    var otoc = document.querySelector("ul li a[href='#"+hs[0].getAttribute("id")+"']").parentNode.parentNode;
    //console.log(otoc);
    otoc.parentNode.replaceChild(ntoc, otoc);
  } catch (e) {
    document.documentElement.insertBefore(ntoc, document.documentElement.firstElementChild);
  }
}
