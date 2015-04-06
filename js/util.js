function fetchJSONFile(path, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var data = JSON.parse(httpRequest.responseText);
                if (callback) callback(data);
            }
        }
    };
    httpRequest.open('GET', path);
    httpRequest.send();
}
function net46JSONFile(path, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var str = httpRequest.responseText;
                str = str.substring(0, str.indexOf('<')-1);
                var data = JSON.parse(str);
                if (callback) callback(data);
            }
        }
    };
    httpRequest.open('GET', path);
    httpRequest.send();
}
function httpGet(url) {
	var xmlHttp = new XMLHttpRequest({
		mozSystem: true
	});
	xmlHttp.open("GET", url, false);
	xmlHttp.send(null);
	return xmlHttp.responseText;
}
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
	var R = 6371000; // Radius of the earth in km
	var dLat = deg2rad(lat2 - lat1); // deg2rad below
	var dLon = deg2rad(lon2 - lon1);
	var a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c; // Distance in km
	return d;
}

function deg2rad(deg) {
	return deg * (Math.PI / 180)
}
