//
// Copyright (c) 2013, Hans Baschy
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
// First implementation - Hans Baschy <jrguiguy13 AT nrvr DOT com>
//

// a specific algorithm
Adj.algorithms.randomTilt = {
	phaseHandlerName: "adjPhase7Up",
	parameters: ["maxAngle"],
	method: function randomTilt (element, parametersObject) {
		var usedHow = "used in a parameter for a randomTilt command";
		var variableSubstitutionsByName = {};
		var maxAngle = Adj.doVarsArithmetic(element, parametersObject.maxAngle, 15, null, usedHow, variableSubstitutionsByName); // default maxAngle = 15
		var minAngle = Adj.doVarsArithmetic(element, parametersObject.minAngle, 3, null, usedHow, variableSubstitutionsByName); // default minAngle = 3
		//
		var angle = (maxAngle - minAngle) * (2 * Math.random() - 1);
		if (angle >= 0) {
			angle += minAngle;
		}
		if (angle <= 0) {
			angle -= minAngle;
		}
		//element.setAttribute("transform", "rotate("+Adj.decimal(angle)+")");
		var boundingBox = element.getBBox();
		var cx = boundingBox.x + boundingBox.width / 2;
		var cy = boundingBox.y + boundingBox.height / 2;
		angle = angle / 180 * Math.PI;
		var a = Math.cos(angle);
		var b = Math.sin(angle);
		var c = -b;
		var d = a;
		var e = cx - a*cx - c*cy;
		var f = cy - b*cx - d*cy;
		element.setAttribute("transform", "matrix("+Adj.decimal(a)+","+Adj.decimal(b)+","+Adj.decimal(c)+","+Adj.decimal(d)+","+Adj.decimal(e)+","+Adj.decimal(f)+")");
	}
}
