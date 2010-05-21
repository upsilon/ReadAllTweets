var readAT = {
checkInterval : 300000,
numOfTweetsShowingAtOneTime : 20,
setIntervalID : null,
unreadCount : 0,
lastStatus : null,
newLastStatus : null,
ol : null,
lis : null,
lastDM : -1,
user : null,
targetBrowser : null,
onceCanceled : false,
baseUrl: null,
nativeJSON : Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON),
Branch: Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService)
		.getBranch("extensions.readalltweets."),
init: function() {
	var appcontent = document.getElementById("appcontent");   // ブラウザ
	if(appcontent)
		appcontent.addEventListener("DOMContentLoaded", readAT.onPageLoad, true);
	
    this.Branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    this.Branch.addObserver("", this, false);
},
uninit : function(){
},
observe: function(aSubject, aTopic, aData){
    if(aTopic != "nsPref:changed") return;
    // aSubject is the nsIPrefBranch we're observing (after appropriate QI)
    // aData is the name of the pref that's been changed (relative to aSubject)
    switch (aData) {
      case "general.changeColorOfNewTweets":
        readAT.setCSS();
        // extensions.myextension.pref1 was changed
        break;
      case "general.checkIntervalOfNewTweets" :
      	readAT.setCheckInterval();
    }
},
setCSS : function(){
	var doc = readAT.targetBrowser.contentDocument;
	
	var css = doc.getElementById("RAT_CSS");
    if(!css) {
      var head = doc.getElementsByTagName("head")[0];

      css = doc.createElement("style");
      css.setAttribute("type", "text/css");
      css.id = "RAT_CSS";
      head.appendChild(css);
    }
	css.innerHTML = "li.RAT_buffered{display : none !important}\n" +
	"a.RAT_setting_link:hover{cursor:pointer !important; text-decoration: none;}";
	
	if(this.Branch.getBoolPref("general.changeColorOfNewTweets")){
		css.innerHTML += "li.RAT_newTweets{background-color : #DDFFFF} ol.statuses li.RAT_newTweets:hover{background-color:#D5F7F7;}\n" +
		"li.RAT_newReplies{background-color : #E6FFE6} ol.statuses li.RAT_newReplies:hover{background-color : #DEF7DE;}";
	}
},
setCheckInterval : function(){
	readAT.checkInterval = 60000 * this.Branch.getIntPref("general.checkIntervalOfNewTweets");
	if(!readAT.checkInterval){
		this.Branch.setIntPref("general.checkIntervalOfNewTweets", 1);
		readAT.checkInterval = 60000 * this.Branch.getIntPref("general.checkIntervalOfNewTweets");
	}
	
	clearInterval(readAT.setIntervalID);
    readAT.setIntervalID = setInterval(readAT.showNewStauses, readAT.checkInterval);
    setTimeout(function(){
        clearInterval(readAT.setIntervalID2);
        readAT.setIntervalID2 = setInterval(readAT.showReplies, readAT.checkInterval);
    }, 30000);
},
onPageLoad : function(aEvent){
    var doc = aEvent.originalTarget; // doc は "onload" event を起こしたドキュメント
    if(!doc) return;

    var uri = doc.location.href;
//    Application.console.log(uri)
	if(readAT.targetBrowser && readAT.targetBrowser.contentDocument==doc){
		readAT.targetBrowser=null; 
	}
    if(!uri.match(readAT.genUrlRegex('\/')))	return;

/*    
 	//うまくいかない
	var home_tab = doc.getElementById("home_tab");
	home_tab.addEventListener("click", function(){gBrowser.getBrowserForDocument(doc).loadURI(home_tab.firstChild.href)} , false);
*/
	 if(uri.match(readAT.genUrlRegex('\/($|home$|#)'))){
		readAT.setSettingsLink(doc);
	}

    if(doc.body.id=="list" && uri.match(readAT.genUrlRegex('\/(#home)?$'))){
     	setTimeout(function(){
     		readAT.checkLoadFinished(0, doc);
     	}, 500);
     	return;
     }
     else{
	    doc.body.addEventListener("DOMAttrModified", readAT.bodyIdObserver, false);
     	readAT.checkListName(uri, doc.body.id, doc);
     }
},
checkLoadFinished : function(aCount, doc){
 	var ol = doc.getElementById("timeline");
 	if(ol.getElementsByTagName("li").length){
	    doc.body.addEventListener("DOMAttrModified", readAT.bodyIdObserver, false);
		readAT.checkListName(doc.location.href, doc.body.id, doc);
		return;
 	}
 	else{
 		setTimeout(function(){
     		readAT.checkLoadFinished(aCount+1, doc);
     	}, 500);
 	}
 	if(aCount>10) return;
},
bodyIdObserver : function(aEvent){
    if(aEvent.attrName!="id") return;

    //イベントを起こしたブラウザの検索
    var tmp;
	var numTabs = gBrowser.tabContainer.childNodes.length;
	for(var index=0; index<numTabs; index++) {
		var currentBrowser = gBrowser.getBrowserAtIndex(index);
		if(currentBrowser.contentDocument.body == aEvent.explicitOriginalTarget){
			tmp = currentBrowser;
			break;
		}
    }
    if(!tmp) return;
    
    var uri = tmp.currentURI.spec;
    var bodyid = aEvent.newValue;
    readAT.checkListName(uri, bodyid, tmp.contentDocument);
 },
checkListName : function(uri, bodyid, doc){
    readAT.removeHTMLChange(doc);
    if(!(bodyid=="home" || bodyid=="list" || bodyid=="list_show") || 
    	!readAT.isTargetList(uri)){
    	if(readAT.targetBrowser && readAT.targetBrowser.contentDocument==doc) readAT.targetBrowser=null; 
	  	return;
    }
    readAT.start(doc);
    return;
},
isTargetList : function(uri){
	readAT.listname = readAT.Branch.getCharPref("general.lists");
     
    if(uri.match(readAT.genUrlRegex("\/\??[^#/]*(#|#home)?$"))){
     	return readAT.listname=="";
    }
	else{
		if(uri.match(readAT.genUrlRegex("\/\??[^#\/]*#\/?list\/(.*)"))){
			return readAT.listname==RegExp.$1;
		}
		else if(uri.match(readAT.genUrlRegex("\/([^\/]*)\/lists\/([^\/]*)"))){
			return readAT.listname==RegExp.$1 +"/"+ RegExp.$2;
		}
		else if(uri.match(readAT.genUrlRegex("\/(.*)"))){
			return readAT.listname==RegExp.$1;
		}
		else return false;
	}
},
setSettingsLink : function(doc){
	if(doc.getElementById("RAT_settings")) return;
	var side = doc.getElementById("side");
	if(!side){
		side = doc.getElementById("side_base");
		if(!side) return;
	}

	var bundle = document.getElementById("readalltweets-bundle");

	var RAT_settings = doc.createElement("div");
	RAT_settings.id = "RAT_settings";
	RAT_settings.innerHTML = "<hr/>"
	var RAT_settings_h2 = doc.createElement("h2");
	RAT_settings_h2.setAttribute("class", "sidebar-title");
	
	var RAT_settings_img = doc.createElement("img");
	RAT_settings_img.setAttribute("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAABnRSTlMA/wAAAACkwsAdAAAC3UlEQVR42q2VTUiUQRjH//OxX8ruuqZGu4am+Un3jCiCQrpFJ7tGEhl2CjwXSB0KilLoUHSpg0SdvdiHRUTQMSjbwnRzyUh31dT1nXmmmZVq/VotmsPLO8O8v3me//+Z52UG/2ewTUHq85hx+4ysrfkXkF7MmYBfFqzYnRqQjP0FSBsjDIH0RI6NLLIFjeoAWkIkudHCz7JZXla2OchRvNwk+a6l8DiDWQUCAhx1QXQl0B7VSvh4JsNjsWIgS+He0riWp98juYCYBF/ex/BDI2fQs5N1bvdsXGJljmtAWhPRqRH+agaVfmQ8CGZ1wbxGRDqZZjTuNmFfhDSXhXqtACmlJGdDUzibxDaJrEJbFGfiKJMYmsatCfgZ5gh7w7jToMAlF2IDEJEw+sIoH/iGUoFyiUd7EJZ5wxiujuF2GmHhAnzYTPESAc43BpE6mxTPsyCDI+W40YCcdhzO8GYWJ98hKpxS9xupNSJYcVDXBzGcRVC47AojuplC3xcHsrMHzVRTugXQsyyi0hm/P4ruaufd0wyup5yDOUJ9CANNSsriGv0ChfMnW7P83GlszSrh7v3rEi7XoaOSVDHXVoJsHQpXWY5oBfaAKQ8nqnCployQxepoBUjCI5cLz++32pdKHK/AuQS4vT1K82BwSyBrrpVmTmHRuPthy9qVTwuM0iR8gq++uuuDXmShgGMVOBpDdxIB5tTJKLTHcGU3fIaMp0QotAnI1VHG6XIohv5GDH5Hz0d3UYJWac/KjN4aDekrqpHWtrI7R8TrWQc6EEVfo0M8mcb5pNM+ZHMkDLauLus1INtAyLs3KS6OumnvLnRUIefpoJ8PT7OeT0gv4XAZ+ut1QHDr/oYgmpxERQVX3ss5YY9rCxuy8QthY5HaG13kb+dxMGLCTGt/YJM2YnuI7T3LQVP+yRmjVIoSid8BUH6xmGt/ckynrUgyvqNwUY+NkxC+RHy9L7bwF9ni+AnOWncQ/1WPRQAAAABJRU5ErkJggg==");
	RAT_settings_img.setAttribute("style", "float:left;");
	var RAT_settings_a = doc.createElement("a");
	RAT_settings_a.style.display = "block";	RAT_settings_a.style.height = "24px";
	RAT_settings_a.setAttribute("class", "RAT_setting_link");
	RAT_settings_a.href = "javascript:void(0)";
	RAT_settings_a.appendChild(RAT_settings_img);
	var RAT_settings_span = doc.createElement("span");
//	RAT_settings_span.setAttribute("style", "position:absolute;bottom:0");
	RAT_settings_span.innerHTML = readAT.getShortAddonName(bundle)+" "+bundle.getString("settings");
	RAT_settings_a.appendChild(RAT_settings_span);
	RAT_settings_a.addEventListener("click", 
		function(){ window.openDialog('chrome://readalltweets/content/readATOption.xul'); }, false);
	RAT_settings_h2.appendChild(RAT_settings_a);
	RAT_settings.appendChild(RAT_settings_h2);
	
	side.appendChild(RAT_settings);
	return;
},
getShortAddonName : function(bundle){
	return bundle.getString("extensions.readalltweets@masahal.info.name").replace(/\s?\(.*\)/, "");
},
checkAlreadyOpened : function (doc) {
	//既にTwitterが開かれてるかどうか
	var thisBrowser = gBrowser.getBrowserForDocument(doc);
	if(readAT.targetBrowser){
		var preDoc = readAT.targetBrowser.contentDocument;
		//このエレメントが存在するかどうかで既に実行されているかどうか判断
		if(readAT.targetBrowser.currentURI && readAT.targetBrowser.currentURI.host=="twitter.com" &&
		preDoc && (preDoc.getElementById("RAT_separator") || preDoc.getElementById("RAT_processing"))){
            return true;
        }
    }
    return false;
},
insertNotifyAtTop : function (doc, html, attributes) {
    var notifyDiv = doc.createElement("div");

    notifyDiv.style.display = "block";
    for (attrName in attributes) {
        notifyDiv.setAttribute(attrName, attributes[attrName]);
    }
    notifyDiv.innerHTML = html;

    var timeline = doc.getElementById("timeline");
    timeline.parentNode.insertBefore(notifyDiv, timeline);

    return notifyDiv;
},
notifyAlreadyOpened : function (doc, bundle) {
    var html = readAT.getShortAddonName(bundle)+"<br>"+bundle.getString("alreadyOpened");
    readAT.insertNotifyAtTop(doc, html, {"class": "minor-notification"});
},
createProcessingDiv : function (doc, bundle) {
    var html = bundle.getString("processing") + ' (<span id="RAT_processing_count">1</span>)';
    readAT.insertNotifyAtTop(doc, html, {id: "RAT_processing", "class": "minor-notification"});
},
start : function(doc){
	if(readAT.Branch.getBoolPref("general.disableThisAddonTemporarily")) return;

	var bundle = document.getElementById("readalltweets-bundle");

//	Application.console.log(doc.location.href)

	if(readAT.checkAlreadyOpened(doc)){
        readAT.notifyAlreadyOpened(doc, bundle);
		return;
	}
    readAT.targetBrowser = gBrowser.getBrowserForDocument(doc);
	readAT.baseUrl = doc.location.protocol + '//' + doc.location.host + '/';

    readAT.ol = doc.getElementById("timeline");

    readAT.createProcessingDiv(doc, bundle);

	readAT.setSettingsLink(doc);
    
    var metas = doc.getElementsByTagName("meta");
    for(var i=0; i<metas.length; i++){
        if(metas[i].getAttribute("name")=="session-user-screen_name"){
            readAT.user = metas[i].getAttribute("content");
            break;
        }
    }
    
	readAT.separatorHidden = false;    
    
	
	readAT.numOfTweetsShowingAtOneTime = readAT.Branch.getIntPref("general.numOfTweetsShowingAtOneTime");
	readAT.twitterUpdateIsWorking = false;

	readAT.setCSS();

	var ptUpdateSource = doc.getElementById('source');
	if(ptUpdateSource) ptUpdateSource.value = 'Read All Tweets(Reverse timeline)';

	readAT.lis = readAT.getLis(readAT.ol);
	for(var i=0; i<readAT.lis.length; i++){
		var a = readAT.lis[i].getElementsByTagName("a");
		for(var j=0; j<a.length; j++){
			a[j].setAttribute("target","_blank");
		}
	}
		
	var new_results_notification = doc.getElementById("new_results_notification");
	var data = readAT.nativeJSON.decode(new_results_notification.getAttribute("data"));
	readAT.max_refresh_size = data["timeline"]["max_refresh_size"];

	readAT.alreadyReadLi = null;
	readAT.lastStatus = readAT.getLastStatus();
	readAT.newLastStatus = readAT.lis[0].getAttribute("id").replace("status_","")-0;
	if(readAT.lastStatus==0){
		readAT.setLastStatus(readAT.newLastStatus);
		readAT.setLastReply(readAT.newLastStatus);

		var cls = "bulletin warning";
		//chronological order
		var msg = bundle.getString("belowHaveBeenSettedAsAlreadyRead") +"<br/>";
		readAT.separator = readAT.createLi(cls, msg, {id: "RAT_separator"});
		
		var RAT_settings_a2 = doc.createElement("a");
		RAT_settings_a2.setAttribute("class", "RAT_setting_link")
		RAT_settings_a2.innerHTML = readAT.getShortAddonName(bundle)+" "+bundle.getString("settings");
		RAT_settings_a2.addEventListener("click", 
			function(){ window.openDialog('chrome://readalltweets/content/readATOption.xul'); }, false);		
		
		readAT.separator.firstChild.appendChild(RAT_settings_a2);
		readAT.ol.insertBefore(readAT.separator, readAT.lis[0]);
		
		readAT.finish(doc);
		return;
	}
	readAT.newLastReply = readAT.getLastReply();
	readAT.newLastDM = readAT.getLastDM();

	var newTweetsCount = 0;

//	GM_log("0, "+readAT.getTime());
	var failed = false;
	while(true){
		var status = readAT.lis[newTweetsCount].getAttribute("id").replace("status_", "")-0;
		
		if(status <= readAT.lastStatus) break;
		else{
			newTweetsCount++;
			if(!readAT.lis[newTweetsCount]){
				readAT.more = doc.getElementById("more");
				if(readAT.more) var uri = readAT.more.href;
				if(!uri){
					failed = true;
					break;
				}
				
				readAT.moreParent =readAT.more.parentNode; 
				readAT.moreParent.removeChild(readAT.more);
				
				readAT.existingNewTweetsCount2 = newTweetsCount;
				if(readAT.listname){
					var pageKind = "list_show";
				}
				else{
					var pageKind = "home";
				}

				readAT.getStatusesInit(uri, "more", readAT.lastStatus, pageKind, readAT.start2);

				return;
			}
		}
	}
	readAT.existingNewTweetsCount2 = newTweetsCount;
	readAT.start2(failed, 2, null, 0);
},
//	GM_log("1, "+readAT.getTime());
start2 : function(failed, pageCount, newLis, newTweetsCount){
	newTweetsCount += readAT.existingNewTweetsCount2;
	
	var doc = readAT.targetBrowser.contentDocument;
	var bundle = document.getElementById("readalltweets-bundle");

	if(failed){
        var html = bundle.getString("notAllOfNewTweetsCouldBeGetted");
        readAT.insertNotifyAtTop(doc, html, {"class": "bulletin alert"});
	}

	readAT.lis = readAT.getLis(readAT.ol);
	if(newLis){
		var tmp = newTweetsCount - readAT.existingNewTweetsCount2;
		for(var j=tmp-1; j>-1; j--){
            if(readAT.isReplie(newLis[j])){
                readAT.addClass(newLis[j], "RAT_newReplies");
            }
			readAT.ol.insertBefore(newLis[j], readAT.lis[0]);
		}
		for(var j=1; j<readAT.lis.length; j++){
            if(readAT.isReplie(readAT.lis[j])){
                readAT.addClass(readAT.lis[j], "RAT_newReplies");
            }
			readAT.ol.insertBefore(readAT.lis[j], readAT.lis[j-1]);
		}
		//未読でない newLis
		for(var j=tmp; j<newLis.length; j++){
			readAT.ol.appendChild(newLis[j]);
		}
		readAT.moreParent.appendChild(readAT.more);
		readAT.more.href = readAT.more.href.replace(/&page=\d+/, "&page="+pageCount);
	}
	else if(newTweetsCount){
        if(readAT.isReplie(readAT.lis[0])){
            readAT.addClass(readAT.lis[0], "RAT_newReplies");
        }
		for(var j=1; j<newTweetsCount; j++){
            if(readAT.isReplie(readAT.lis[j])){
                readAT.addClass(readAT.lis[j], "RAT_newReplies");
            }
			readAT.ol.insertBefore(readAT.lis[j], readAT.lis[j-1]);
		}
	}	
			
	var cls = "bulletin warning";
	var msg = bundle.getString("belowAreAlreadyRead")+
	' <a href="javascript:void(0);" onclick="javascript:window.scroll(0, 0); return false;" style="display:block; float:right;">'+
	bundle.getString("goToTop")+"</a>";
	readAT.separator = readAT.createLi(cls, msg, {id: "RAT_separator"});
	if(newTweetsCount){
		if(readAT.lis[0].nextSibling) readAT.ol.insertBefore(readAT.separator, readAT.lis[0].nextSibling);
		else readAT.ol.appendChild(readAT.separator);
	}
	else readAT.ol.insertBefore(readAT.separator, readAT.lis[0]);
		
	//heading.appendChild(moveToUnread);

	readAT.unreadCount = newTweetsCount;
	
	//GM_log("readAT.lis.length:"+readAT.lis.length+" "+"readAT.numOfTweetsShowingAtOneTime:"+readAT.numOfTweetsShowingAtOneTime);

	readAT.lis = readAT.getLis(readAT.ol);

	//"buffered" class を消す
	for(var i=0; i<readAT.lis.length; i++){
		var cls = readAT.lis[i].getAttribute("class");
		if(!cls) break;
		if(cls.indexOf(" buffered")>-1) readAT.removeClass(readAT.lis[i], "buffered");
		else break;
	}
	//separator の分だけ＋1してある
	if(readAT.numOfTweetsShowingAtOneTime && readAT.lis.length > readAT.numOfTweetsShowingAtOneTime+1){
		readAT.lastShownStatus = readAT.lis[readAT.numOfTweetsShowingAtOneTime];
		readAT.lastShownStatusesCount = readAT.numOfTweetsShowingAtOneTime+1;
		
		var li = readAT.lastShownStatus;
		while(li = li.nextSibling){
			if(li.nodeName!="LI") continue;
			readAT.addClass(li, "RAT_buffered");
		}
		var nextDiv = doc.createElement("div");
		nextDiv.id = "showNext";
		nextDiv.setAttribute("class", "more round");
		nextDiv.innerHTML = bundle.getFormattedString("showNextTweets", [readAT.numOfTweetsShowingAtOneTime]); 
		readAT.more.parentNode.appendChild(nextDiv);
		readAT.more.parentNode.removeChild(readAT.more);
		//nextDiv.addEventListener("click", readAT.showNextTweets, false);
		doc.addEventListener('scroll', readAT.showNextTweets, false);
	}
	
	if(readAT.separator.getAttribute("class").indexOf(" RAT_buffered")>-1) readAT.separatorHidden = true;

	//セッションの復元などで開かれた場合、スクロールも復元されるため、一番上にスクロールする。
	var win = readAT.targetBrowser.contentWindow;
	if(readAT.getOffsetTopBody(readAT.lis[0]) < win.pageYOffset){
		win.scroll(0, 0);
	}
	
	readAT.showUnreadCount();
	readAT.finish(doc);
	readAT.showReplies();
	
	return;
},
finish : function(doc){
	var processingDiv = doc.getElementById("RAT_processing");
	processingDiv.parentNode.removeChild(processingDiv);

	readAT.setHTMLChange(doc);

	readAT.lastUpdateTime = readAT.getNow();
	
	readAT.setCheckInterval();
	doc.body.addEventListener('DOMNodeInserted', readAT.updateCheck, false);

	readAT.nowUpdatingWhenUserPosts = false;
    var ptUpdateButton = doc.getElementById('tweeting_button') || doc.getElementById('update-submit');
    if(ptUpdateButton)
    	ptUpdateButton.addEventListener('click', function(){
    	readAT.nowUpdatingWhenUserPosts=true;
//        clearInterval(readAT.updateSetTimeout);
//        readAT.updateSetTimeout = 
        setTimeout(function(){readAT.showNewStauses();readAT.nowUpdatingWhenUserPosts=false;}, 500);
    	}, true);

	return;	
},
getNow : function(){
	var dd = new Date();
	return dd.getTime();
},
setHTMLChange : function(doc){
	var bundle = document.getElementById("readalltweets-bundle");
    
	var moveToUnread = doc.createElement("a");
	moveToUnread.id = "RAT_moveToUnreadTweets";
	moveToUnread.href = "javascript:void(0);";
	moveToUnread.innerHTML = bundle.getString("moveToUnreadTweets");
	moveToUnread.addEventListener("click", readAT.moveToUnreadTweets, false);
	if(readAT.listname){
		moveToUnread.setAttribute("style", "display: block; margin: 16px 0 5px; text-align: right; font-size: 1.2em;");
		readAT.ol.parentNode.insertBefore(moveToUnread, readAT.ol);
//		var heading = doc.getElementById("timeline_heading");
//		moveToUnread.setAttribute("style", "display: block; margin: 0px 0px 2px; text-align: right; font-size: 1.2em;");
//		heading.appendChild(moveToUnread);
	}
	else{
		var heading = doc.getElementById("heading");
		moveToUnread.setAttribute("style", "display: block; margin: 5px 0px; text-align: right; font-size: 1.2em;");
		heading.parentNode.insertBefore(moveToUnread, heading.nextSibling);
	}
/*
        var heading = doc.getElementById("heading");
        heading.style.margin = "0 0 10px";
        moveToUnread.setAttribute("style", "display: block; margin: 5px 0px; text-align: right; font-size: 1.2em;");
        heading.parentNode.insertBefore(moveToUnread, heading.nextSibling);
*/	
	var new_results_notification = doc.getElementById("new_results_notification");
	new_results_notification.innerHTML = '<div style="display:none">'+new_results_notification.innerHTML+'</div>';
	
	//new_results_notification.style.display = "none";
	//new_results_notification.style.visibility = "hidden";
	return;
},
removeHTMLChange : function(doc){
  	var RAT_moveToUnreadTweets = doc.getElementById("RAT_moveToUnreadTweets");
	if(!RAT_moveToUnreadTweets) return; 

	RAT_moveToUnreadTweets.parentNode.removeChild(RAT_moveToUnreadTweets);

	var new_results_notification = doc.getElementById("new_results_notification");
	new_results_notification.firstChild.style.display ="block";

	var doc = readAT.targetBrowser.contentDocument;
	doc.body.removeEventListener('DOMNodeInserted', readAT.updateCheck, false);
},
moveToUnreadTweets : function(){
	if(!readAT.alreadyReadLi) return;
	readAT.targetBrowser.contentWindow.
		scroll(0, readAT.getOffsetTopBody(readAT.alreadyReadLi.nextSibling));
},
getLastStatus : function(){
	var lastStatusList = this.nativeJSON.decode(this.Branch.getComplexValue("lastStatus",
      Components.interfaces.nsISupportsString).data);
	
    if(readAT.listname){
    	var tmp = readAT.listname.split("/");
    	var user = tmp[0];
    	var list = tmp[1];
    }
    else{
    	var user = readAT.user;
    	var list = "/all";
    }
    if(!lastStatusList[user] || !lastStatusList[user][list]){
		return 0;
    }
    
    var lastStatus = lastStatusList[user][list]-0;
    return lastStatus;    
},
setLastStatus : function(lastStatus){
	if(!lastStatus) return;
	var lastStatusList = this.nativeJSON.decode(this.Branch.getComplexValue("lastStatus",
      Components.interfaces.nsISupportsString).data);
      
    if(readAT.listname){
    	var tmp = readAT.listname.split("/");
    	var user = tmp[0];
    	var list = tmp[1];
    }
    else{
    	var user = readAT.user;
    	var list = "/all";
    }

    if(!lastStatusList[user]){
    	lastStatusList[user] = {};
    }
    
    lastStatusList[user][list]=lastStatus;

	var str = Components.classes["@mozilla.org/supports-string;1"]
	      .createInstance(Components.interfaces.nsISupportsString);
	str.data = this.nativeJSON.encode(lastStatusList);
	this.Branch.setComplexValue("lastStatus", 
	      Components.interfaces.nsISupportsString, str);
	
	return
},
getLastReply : function(){
	var lastReplyList = this.nativeJSON.decode(this.Branch.getComplexValue("lastReply",
      Components.interfaces.nsISupportsString).data);
	
    if(!readAT.user) return -1;  
    if(!lastReplyList[readAT.user]){
    	readAT.setLastReply(readAT.lastStatus);
    	return readAT.lastStatus;
    }
    return lastReplyList[readAT.user]-0;
},
setLastReply : function(lastStatus){
	if(!lastStatus) return;
	var lastReplyList = this.nativeJSON.decode(this.Branch.getCharPref("lastReply"));
      
    lastReplyList[readAT.user]=lastStatus;

	this.Branch.setCharPref("lastReply", this.nativeJSON.encode(lastReplyList));
	
	return
},
getLastDM : function(){
	var lastDMList = this.nativeJSON.decode(this.Branch.getCharPref("lastDM"));

    if(!lastDMList[readAT.user]){
 		return -1;
     }
    
    var lastDM = lastDMList[readAT.user]-0;
    
    return lastDM;
},
setLastDM : function(lastDM){
	if(!lastDM) return;
	var lastDMList = this.nativeJSON.decode(this.Branch.getComplexValue("lastDM",
      Components.interfaces.nsISupportsString).data);
      
    lastDMList[readAT.user] = lastDM;

	var str = Components.classes["@mozilla.org/supports-string;1"]
	      .createInstance(Components.interfaces.nsISupportsString);
	str.data = this.nativeJSON.encode(lastDMList);
	this.Branch.setComplexValue("lastDM", 
	      Components.interfaces.nsISupportsString, str);
	
	return
},
getTime : function(){
	var dd = new Date();
	var h = dd.getHours();
	var m = dd.getMinutes();
//	var s = dd.getSeconds();
	if(h<10) h='0'+h;
	if(m<10) m='0'+m;
//	if(s<10) s='0'+s;

	return h+':'+m;
},
showNextTweets : function(){
//GM_log("hideTweets.length:"+readAT.hideTweets.length+" readAT.lis.length:"+readAT.lis.length)
	var doc = readAT.targetBrowser.contentDocument;
	var win = readAT.targetBrowser.contentWindow;

	var nextDiv = doc.getElementById("showNext");
	var top = readAT.getOffsetTopBody(nextDiv);
	if(top < win.pageYOffset || top > win.pageYOffset + win.innerHeight) return;
	
	doc.removeEventListener('scroll', readAT.showNextTweets, false);
	
	readAT.lis = readAT.getLis(readAT.ol);
		
	var lastLi = readAT.lastShownStatus;
	readAT.addClass(lastLi, "last-on-page");	
/*	if(!lastLi){
		for(var i=0; i<readAT.lis.length; i++){
			if(readAT.lis[i].getAttribute("class").indexOf(" RAT_buffered")>-1) break;
		}
		lastLi = readAT.lis[i-1];
	}*/
	if(readAT.separatorHidden){
		//Read All Tweets からのメッセージ以外なら。
		var li = lastLi;
		while(li.nodeName!="LI" || li.getAttribute("class").indexOf(" RATMessage")>-1){
			li = li.previousSibling;
		}
		readAT.setLastStatus(li.id.replace("status_",""));
		
		readAT.unreadCount -= readAT.lastShownStatusesCount;
		readAT.showUnreadCount();
	}
//	setTimeout(function(){
	
	readAT.lastShownStatusesCount = 0;
	var finished = false;
	var li = lastLi;
	for(var i=0; i<readAT.numOfTweetsShowingAtOneTime; i++){
		li = li.nextSibling;
		if(!li){
			finished = true;
			break;
		}
		if(li.nodeName!="LI"){
			i--;
			continue;
		}
		
		if(li.getAttribute("class").indexOf(" RATMessage")==-1) readAT.lastShownStatusesCount++;
		readAT.removeClass(li, "RAT_buffered");
	}
	if(readAT.separator.getAttribute("class").indexOf(" RAT_buffered")==-1) readAT.separatorHidden = false;
	if(finished || !li.nextSibling){
		nextDiv.parentNode.appendChild(readAT.more);
		nextDiv.parentNode.removeChild(nextDiv);
	}
	else{
		readAT.lastShownStatus = li;
		doc.addEventListener('scroll', readAT.showNextTweets, false);
	}
//	}, 50);
},
addClass : function(aElem, aClass){
	aElem.setAttribute("class", aElem.getAttribute("class")+" "+aClass);
	return;
},
removeClass : function(aElem, aClass){
	aElem.setAttribute("class", (" "+aElem.getAttribute("class")+" ").replace(" "+aClass+" "," "));
	return;
},
includeClass : function(aElem, aClass){
	var cls = " "+aElem.getAttribute("class")+" ";
	return (cls.indexOf(" "+aClass+" ")>-1);	
},
showUnreadCount : function(){
	var doc = readAT.targetBrowser.contentDocument;
	
	if(readAT.unreadCount){
		if(doc.title.match(/^\(\d+\)\s/)) doc.title = doc.title.replace(RegExp.lastMatch, '('+ readAT.unreadCount + ') ');
		else doc.title = '('+ readAT.unreadCount + ') '+  doc.title;
		doc.addEventListener('scroll', readAT.resetUnreadCount, false);
		doc.addEventListener('mouseover', readAT.resetUnreadCount, false);
		gBrowser.tabContainer.addEventListener("TabSelect", readAT.tabSelected, false);

		if(readAT.alreadyReadLi && !readAT.includeClass(readAT.alreadyReadLi, "last-on-refresh")){
			readAT.addClass(readAT.alreadyReadLi, "last-on-refresh");
		}
	}
	else{
		if(doc.title.match(/^\(\d+\)\s/)) doc.title = doc.title.replace(RegExp.lastMatch, '');
	}

	return;
},
updateCheck : function(aEvent){
	if(aEvent.target.id!="results_update") return;

	readAT.twitterUpdateIsWorking = true;
	setTimeout(function(){readAT.updateStatuses(aEvent.target)}, 20);
},
updateStatuses : function(target){
	readAT.lastStatus = readAT.newLastStatus-0;
	
//	target.innerHTML = "";	
	readAT.lis = readAT.getLis(readAT.ol);


	var count = target.innerHTML.match(/\d+/);
	
	var newLis = new Array();
	for(var i=0; i<readAT.lis.length; i++){
		if(!readAT.includeClass(readAT.lis[i],"buffered")){
			if(readAT.includeClass(readAT.lis[i], "mine")){
				var status = readAT.lis[i].id.replace("status_", "")-0;
				if(status<=readAT.lastStatus) break; 
			}
			else break;
		}
		newLis[i] = readAT.lis[i];
		readAT.addClass(newLis[i], "RAT_buffered");
		var a = newLis[i].getElementsByTagName("a");
		for(var j=0; j<a.length; j++){
			a[j].setAttribute("target", "_blank");
		}
	}
	var newTweetsCount = i;

	var evt = document.createEvent( "MouseEvents" ); // マウスイベントを作成
	evt.initEvent("click", false, true ); // イベントの詳細を設定
	target.dispatchEvent( evt ); // イベントを強制的に発生させる

	//アドオン側で更新してる場合は、こちらのTweets は消去する。
	if(readAT.nowFetchingNewStatuses || readAT.nowUpdatingWhenUserPosts){
		for(var i=0; i<newLis.length; i++){
			readAT.ol.removeChild(newLis[i]);
		}
		return;
	}
    //Twitter 側の最大更新件数以上の新着発言がある場合、削除してアドオン側で更新。
	if(count==readAT.max_refresh_size){
		for(var i=0; i<newLis.length; i++){
			readAT.ol.removeChild(newLis[i]);
		}
		readAT.twitterUpdateIsWorking = false;
		readAT.showNewStauses();
		
		return;		
	}
	
	var j=newTweetsCount-1;
	while(true){
		if(newLis[j]){
			if(readAT.includeClass(newLis[j], "last-on-refresh")){
				readAT.removeClass(newLis[j], "last-on-refresh");
				break;
			}
		}
		else break
		j--;
	}
	readAT.showNewStauses2(false, null, newLis, newTweetsCount);
},
tabSelected : function(event){
	var browser = gBrowser.selectedTab.linkedBrowser;
	if(browser != readAT.targetBrowser) return;
	
	readAT.resetUnreadCount();
},
resetUnreadCount : function(){
	var doc = readAT.targetBrowser.contentDocument;
	var win = readAT.targetBrowser.contentWindow;

	if(readAT.separatorHidden) return;
	if(gBrowser.selectedBrowser != readAT.targetBrowser) return;
	
	readAT.separator = doc.getElementById("RAT_separator");
	
	var top = readAT.getOffsetTopBody(readAT.separator.firstChild);
//	var height = separator.offsetHeight;
//	GM_log(window.pageYOffset + " " +top+ " " + window.innerHeight);

	if(top < win.pageYOffset || top > win.pageYOffset + win.innerHeight) return;

	
	readAT.unreadCount = 0;
    readAT.preAlreadyReadLi = readAT.alreadyReadLi;
	readAT.alreadyReadLi = readAT.separator.previousSibling;
	readAT.showUnreadCount();
	doc.removeEventListener('scroll', readAT.resetUnreadCount, false);
	doc.removeEventListener('mouseover', readAT.resetUnreadCount, false);
	gBrowser.tabContainer.removeEventListener("TabSelect", readAT.tabSelected, false);
	
	readAT.setLastStatus(readAT.newLastStatus);
	readAT.setLastReply(readAT.newLastReply);
	readAT.setLastDM(readAT.newLastDM);

	return;
},
getOffsetTopBody : function(elem){
	var top = elem.offsetTop;
	var parentElem = elem.offsetParent;
	while(parentElem.tagName != "BODY"){
		top += parentElem.offsetTop;
		parentElem = parentElem.offsetParent;
	}
	return top;
},
getStatusesInit : function(uri, moreId, lastStatus, pageKind, returnFunc){
	readAT.getStatuses(uri, moreId, lastStatus, pageKind, returnFunc, new Array(), 0, 0);	
},
getStatuses : function(uri, moreId, lastStatus, pageKind, returnFunc, newLis, newTweetsCount, failedCount){
	var doc = readAT.targetBrowser.contentDocument;
	
	var countSpan = doc.getElementById("RAT_processing_count");
	if(countSpan){
		uri.match(/[?&]page=(\d+)/);
		var pageCount = RegExp.$1;
		countSpan.innerHTML = pageCount;
	}

	var req = new XMLHttpRequest();
	req.open('GET', uri, true);
	req.overrideMimeType('text/xml');
    
	req.onreadystatechange = function (aEvt) {
	  if (req.readyState == 4) {
	     if(req.status == 200){
			//整形式になってないとエラーが出る（AT&Tなど＆が含まれている語が流行のトピックに入ってる場合）可能性があるので、responseXML ではなく responseText でいく
			var res = req.responseText.replace(/[\n\r]/g, " ");
			
			//body の id から、適切なページを取得できてるかを検証
			var re = new RegExp('<body [^>]* id="([^"]*)');
			res.match(re);
			var bodyId = RegExp.$1;
			if(pageKind!=bodyId){
		     	if(failedCount<2){
                    setTimeout(function(){
                        readAT.getStatuses(uri, moreId, lastStatus, pageKind, returnFunc, newLis, newTweetsCount, true);
                    }, 10000);              
		     	}
		     	else{
                    var pageCount = readAT.getStatusesFinish(uri, newLis);
                    returnFunc(true, pageCount, newLis, newTweetsCount);
		     	}
		     	return;
			}
			
			var tmpOl = readAT.getOl(res, "timeline");
			var tmpLis = readAT.getLis(tmpOl);
			
			if(!tmpLis.length){
				var failed = (uri!=readAT.getUrlFor("replies"));
                var pageCount = readAT.getStatusesFinish(uri, newLis);
                returnFunc(failed, pageCount, newLis, newTweetsCount);
				return;
			}
			var preLength = newLis.length;
			for(var i=0; i<tmpLis.length; i++){
				newLis[preLength+i] = tmpLis[i];
			}
			
//			Application.console.log(readAT.newTweetsCount);
//			Application.console.log(readAT.newLis[readAT.newTweetsCount].innerHTML)

			while(true){
//				alert(readAT.newTweetsCount + " \n" + readAT.newLis[readAT.newTweetsCount].innerHTML)
				var status = newLis[newTweetsCount].getAttribute("id").replace("status_", "")-0;
				//status が適切に取得できなかった場合
//				alert(newLis[newTweetsCount].innerHTML)
				if(status==0){
					Application.console.log(newTweetsCount)
                    var pageCount = readAT.getStatusesFinish(uri, newLis);
                    returnFunc(true, pageCount, newLis, newTweetsCount);
					return;
				}
				
				if(status <= lastStatus){
					break;
				}
				else{
					newTweetsCount++;
					if(!newLis[newTweetsCount]){
						var span = doc.createElement("span");
						var re = new RegExp('<a [^>]*id="'+moreId+'"[^>]*>[^<]*<\/a>');
						span.innerHTML = res.match(re);
						
						if(!span.innerHTML){
                            var pageCount = readAT.getStatusesFinish(uri, newLis);
                            returnFunc(false, pageCount, newLis, newTweetsCount);
							return;
						}
		
						var nextUri = span.firstChild.href;
						
						readAT.getStatuses(nextUri, moreId, lastStatus, pageKind, returnFunc, newLis, newTweetsCount, false);
						return;
					}
				}
			}
			//Application.console.log("status="+status);

            var pageCount = readAT.getStatusesFinish(uri, newLis);
            returnFunc(false, pageCount, newLis, newTweetsCount);
			return;
	     }
	     else{
           if(failedCount<2){
                setTimeout(function(){
                    readAT.getStatuses(uri, moreId, lastStatus, pageKind, returnFunc, newLis, newTweetsCount, true);
                }, 10000);
	     	}
	     	else{
                var pageCount = readAT.getStatusesFinish(uri, newLis);
                returnFunc(true, pageCount, newLis, newTweetsCount);
	     	}
	     	return;
	     }
	  }
	};
    req.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
	req.send(null);
	
},
getStatusesFinish : function(uri, newLis){
//	//新規発言を取得しようとしているときに、 twitter 自体のアップデート機能が働き始めたなら、中止。
//	if(uri.indexOf("http://twitter.com/replies")==-1 && readAT.twitterUpdateIsWorking) return;
	
	for(var i=0; i<newLis.length; i++){
		var a = newLis[i].getElementsByTagName("a");
		for(var j=0; j<a.length; j++){
			a[j].setAttribute("target","_blank");
		}
	}
	
	uri.match(/[?&]page=(\d+)/);
	var pageCount = RegExp.$1;
	if(!pageCount) pageCount = 1;
	pageCount++;

	return pageCount;
},
showNewStauses : function(){
	//テキストエリアにフォーカス中なら後に
	var focusNode = gBrowser.selectedBrowser.contentDocument.activeElement;
	if(readAT.onceCanceled){
		readAT.onceCanceled = false;
	}
	else if(focusNode && (focusNode.tagName=="TEXTAREA" || 
		(focusNode.tagName=="INPUT" && focusNode.getAttribute("type")=="TEXT"))){
			
			readAT.onceCanceled = true;
			window.setTimeout(readAT.showNewStauses, readAT.checkInterval/2)
			return;
	}

	if(!readAT.nowUpdatingWhenUserPosts && readAT.twitterUpdateIsWorking){
		//もし20分以上更新が行われてないなら、Twitterの自動アップデート機能が働いてないと判断し、コードから自動アップデートを行う。
		if(readAT.getNow()-readAT.lastUpdateTime>readAT.Branch.getIntPref("general.checkIntervalOfNewTweets")*2*60000){
			readAT.twitterUpdateIsWorking = false;
		}
		else return;
	}
	readAT.nowFetchingNewStatuses = true;
	
	if(readAT.listname){
		var uri = readAT.getUrlFor(readAT.listname);
		var pageKind = "list_show";
	}
	else{
		var uri = readAT.getUrlFor("home");
		var pageKind = "home";
	}
	readAT.lastStatus = readAT.newLastStatus;
	if(readAT.nowUpdateChecking) return;
	readAT.nowRATUpdateChecking = true;
	readAT.getStatusesInit(uri, "more", readAT.lastStatus, pageKind, readAT.showNewStauses2);
},
showNewStauses2 : function(failed, pageCount, newLis, newTweetsCount){
	readAT.lastUpdateTime = readAT.getNow();
	
	var doc = readAT.targetBrowser.contentDocument;
	
	readAT.separator = doc.getElementById("RAT_separator");

	readAT.lis = readAT.getLis(readAT.ol);

	//自分の発言を消す
	for(var i=0; i<readAT.lis.length; i++){
		var cls = readAT.lis[i].getAttribute("class");
		if(!cls) break;
		if(cls.indexOf(" RAT_buffered")>-1) break;
		if(cls.indexOf(" mine")==-1) break;

		if(readAT.lis[i].id.replace("status_", "")-0>readAT.lastStatus-0){
			readAT.ol.removeChild(readAT.lis[i]);
			selfTweetsCount++;
		}
	}

    /*
     * 漏れが出る
    if(!readAT.unreadCount){
        var preNewStatuses = doc.getElementsByClassName("RAT_newTweets");
        for(var i=0; i<preNewStatuses.length; i++){
            readAT.removeClass(preNewStatuses[i], "RAT_newTweets");
        }
        var preNewReplies = doc.getElementsByClassName("RAT_newReplies");
        for(var i=0; i<preNewReplies.length; i++){
            readAT.removeClass(preNewReplies[i], "RAT_newReplies");
        }
    }
    */
    var li = readAT.alreadyReadLi;
    while(li && li!=readAT.preAlreadyReadLi){
        if(li.nodeName=="LI"){
			var cls = li.getAttribute("class");
			//Read All Tweets からのメッセージ、あるいは自分の発言以外なら。
			if(cls.indexOf(" RATMessage")==-1){
				if(cls.indexOf(" RAT_newTweets")>-1){
					li.setAttribute("class", cls.replace(" RAT_newTweets",""));		
				}
				else if(cls.indexOf(" RAT_newReplies")>-1){
					li.setAttribute("class", cls.replace(" RAT_newReplies",""));		
				}
			}
		}
		li = li.previousSibling;
	}

	if(newTweetsCount){
		readAT.newLastStatus = newLis[0].getAttribute("id").replace("status_", "")-0;
//		alert(readAT.newLastStatus)
	}
	
	if(failed){
		var bundle = document.getElementById("readalltweets-bundle");

		var time = readAT.getTime();
		if(newTweetsCount){
/*
			var div = doc.createElement("div");
			div.appendChild(newLis[0])
			alert(newTweetsCount+" "+readAT.newLastStatus+"\n"+div.innerHTML)
			Application.console.log(newTweetsCount+" "+readAT.newLastStatus+"\n"+div.innerHTML)
*/
			var cls = "bulletin alert";
			var msg = time+'<br/>'+bundle.getString("notAllOfNewTweetsCouldBeGetted");
			var errorLi2 = readAT.createLi(cls, msg);
	
			readAT.ol.insertBefore(errorLi2, readAT.separator);		
		}
		else{
			var cls = "bulletin alert";
			var msg =  time+'<br/>'+bundle.getString("failedToGetNewTweets");
			var cantGetLi = readAT.createLi(cls, msg);
			
			readAT.ol.insertBefore(cantGetLi, readAT.separator);
			
            readAT.nowFetchingNewStatuses = false;
			return;
		}
	}

	var selfTweetsCount = 0;
	for(var j=newTweetsCount-1; j>-1; j--){
		if(readAT.includeClass(newLis[j], "mine")) selfTweetsCount++;
		else{
            if(readAT.isReplie(newLis[j])){
		        if(doc.getElementById(newLis[j].id)){
                    newTweetsCount--;
                    continue;
                }

                readAT.addClass(newLis[j], "RAT_newReplies");
            }
            else readAT.addClass(newLis[j], "RAT_newTweets");
        }
		var status = newLis[j].getAttribute("id").replace("status_", "");

		readAT.ol.insertBefore(newLis[j], readAT.separator);
		
		//update から呼ばれた場合のため
		if(readAT.separatorHidden){
			if(newLis[j].getAttribute("class").indexOf(" RAT_buffered")==-1){
				readAT.addClass(newLis[j], "RAT_buffered");
			}
		}
		else readAT.removeClass(newLis[j], "RAT_buffered");
	}
	
	readAT.unreadCount += newTweetsCount - selfTweetsCount;
	if(selfTweetsCount && !readAT.unreadCount) readAT.setLastStatus(readAT.newLastStatus)
	readAT.showUnreadCount();
	readAT.autoMovingToUnreadTweets();

    readAT.nowFetchingNewStatuses = false;
	
	return;
},
showReplies : function(){
	if(!readAT.Branch.getBoolPref("general.showRepliesToo")){
		readAT.checkDM();	
		return;
	}
	
	var lastReply = readAT.newLastReply;
	if(lastReply>-1) readAT.getStatusesInit(readAT.getUrlFor("replies"), "more", lastReply, "replies", readAT.showReplies2);
	else readAT.checkDM();
},
showReplies2 : function(failed, pageCount, newLis, newTweetsCount){	
	var doc = readAT.targetBrowser.contentDocument;
	readAT.separator = doc.getElementById("RAT_separator");
	readAT.lis = readAT.getLis(readAT.ol);
	
	if(failed){
		var bundle = document.getElementById("readalltweets-bundle");

		var cls = "bulletin alert";
		var time = readAT.getTime();
		if(newTweetsCount){
			var str = "notAllOfNewRepliesCouldBeGetted";
			
			var msg = time+'<br/>'+bundle.getString(str);
			var errorLi3 = readAT.createLi(cls, msg);
			readAT.ol.insertBefore(errorLi3, readAT.separator);
		}
		else{
			var str = "failedToGetNewReples";
			
			var msg = time+'<br/>'+bundle.getString(str);
			var errorLi3 = readAT.createLi(cls, msg);
			readAT.ol.insertBefore(errorLi3, readAT.separator);
			
			readAT.checkDM();
			return;
		}
	}
    if(newLis[0]) readAT.newLastReply = newLis[0].getAttribute("id").replace("status_", "")-0;
	
	var tmp = 0;
	var elm;
	for(var j=newTweetsCount-1; j>-1; j--){
		var statusId = newLis[j].getAttribute("id");
		elm = doc.getElementById(statusId);
		if(elm) continue;
        
		tmp++;

		readAT.addClass(newLis[j], "RAT_newReplies");
		readAT.ol.insertBefore(newLis[j], readAT.separator);
		//update から呼ばれた場合のため
		if(readAT.separatorHidden){
			readAT.addClass(newLis[j], "RAT_buffered");
		}
	}
	readAT.unreadCount += tmp;

	readAT.autoMovingToUnreadTweets();
	readAT.checkDM();
	
	return;
},
checkDM : function(){	
	if(!readAT.Branch.getBoolPref("general.notifyDM")){
		readAT.checkDMFinish();
		return;
	}
	
	var doc = readAT.targetBrowser.contentDocument;
	readAT.separator = doc.getElementById("RAT_separator");

	var message_count = doc.getElementById("message_count");
	if(message_count && message_count.firstChild && message_count.firstChild.nodeValue==0){
		//初期化
		if(readAT.newLastDM==-1) readAT.setLastDM(0);
		readAT.checkDMFinish();
		return;
	}
	var req = new XMLHttpRequest();
	req.open('GET', readAT.getUrlFor("inbox"), true);
	req.overrideMimeType('text/xml');
	req.onreadystatechange = function (aEvt) {
	  if (req.readyState == 4) {
	     if(req.status == 200){
			var res = req.responseText.replace(/[\n\r]/g, " ");
					
			var re = new RegExp('<body [^>]* id="([^"]*)');
			res.match(re);
			var bodyId = RegExp.$1;
			if(bodyId!="inbox"){
				readAT.checkDMFinish();	
				return;
			}
			readAT.lastDM = readAT.newLastDM;

			var tmpOl = readAT.getOl(res, "timeline");
			var tmpLis = readAT.getLis(tmpOl);

			if(!tmpLis.length){
				//初期化
				if(readAT.lastDM==-1){
					readAT.setLastDM(0);
				}
				readAT.checkDMFinish();	
				return;
			}
		
			readAT.newLastDM = tmpLis[0].getAttribute("id").replace("direct_message_", "")-0;
			//初期化
			if(readAT.lastDM==-1){
				readAT.setLastDM(readAT.newLastDM);				
				readAT.checkDMFinish();
				return;
			}

			if(readAT.newLastDM <= readAT.lastDM){
				readAT.checkDMFinish();	
				return;
			}
			
			readAT.unreadCount++;
		
			var bundle = document.getElementById("readalltweets-bundle");
			
			var cls = "bulletin warning";
			var msg = bundle.getString("thereAreNewDMs");
			var alertDMLi = readAT.createLi(cls, msg);
		
			readAT.ol.insertBefore(alertDMLi, readAT.separator);
			//update から呼ばれた場合のため
			if(readAT.separatorHidden){
				readAT.addClass(alertDMLi, "RAT_buffered");
			}
			
			readAT.checkDMFinish();	
	     }
	  }
	}
    req.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");    
	req.send(null);
/*	for(var i = 1; i<tmpLis.length; i++){
		var DM = tmpLis[i].getAttribute("id").replace("direct_message_", "");
		if(DM <= readAT.lastDM) break;
	}
*/

	return;
},
checkDMFinish : function(){
	readAT.showUnreadCount();
	readAT.autoMovingToUnreadTweets();
},
autoMovingToUnreadTweets : function(){
	if(!readAT.unreadCount || gBrowser.selectedBrowser==readAT.targetBrowser) return;
	if(!readAT.alreadyReadLi) return;
	var unreadTweet = readAT.alreadyReadLi.nextSibling;
	if(!unreadTweet) return;
	
	var focusNode = gBrowser.selectedBrowser.contentDocument.activeElement;
	if(focusNode.tagName=="TEXTAREA" || 
		(focusNode.tagName=="INPUT" && focusNode.getAttribute("type")=="TEXT")){
			return;
	}

//	var doc = readAT.targetBrowser.contentDocument;
	var win = readAT.targetBrowser.contentWindow;
	var top = readAT.getOffsetTopBody(unreadTweet);
	//var bottom = top + unreadTweet.height;
	if(top < win.pageYOffset) return;
	if(top > win.pageYOffset && top < win.pageYOffset + win.innerHeight) return;	

	readAT.moveToUnreadTweets();
	return;
},
createLi : function(cls, msg, attributes){
	var doc = readAT.targetBrowser.contentDocument;

    if (!attributes["class"]) {
        attributes["class"] = "";
    }
	attributes["class"] += "hentry status RATMessage";
	if(readAT.separatorHidden) attributes["class"] += " RAT_buffered";

	var li = doc.createElement("li");
    for (attrName in attributes) {
        li.setAttribute(attrName, attributes[attrName]);
    }

	li.innerHTML = '<div class="'+cls+'" style="display: block;">' +msg+'</div>';
	
	return li;
},
getUrlFor : function (path) {
	return readAT.baseUrl + path;
},
getOl : function(string, id){
	var doc = readAT.targetBrowser.contentDocument;
	var re = new RegExp("<ol [^>]*id=['"+'"]'+id+'["'+"'][^>]*>(.*?)</ol>");
	string.match(re);
	var tmpString = RegExp.$1;
	var tmpOl = doc.createElement("ol");
	tmpOl.innerHTML = tmpString;
	return tmpOl;
},
getLis : function(ol){
//    return ol.getElementsByClassName("hentry");
	var rawLis = ol.childNodes;
	var lis = new Array();
	var j = 0;
	for(var i=0; i<rawLis.length; i++){
        if(1 != rawLis[i].nodeType) continue; // ELEMENT_NODE
        if("li" == rawLis[i].tagName.toLowerCase()) lis[j++] = rawLis[i];
	}
    return lis;
},
getOuterHTML : function(aElmArrow){
	var doc = readAT.targetBrowser.contentDocument;
	var r = doc.createRange(), tub = doc.createElement("div");
	r.selectNode(this);
	tub.appendChild(r.cloneContents());
	
	return tub.innerHTML;
},
genUrlRegex : function (path) {
	return new RegExp('^https?:\/\/twitter\.com' + path);
},
isReplie : function(aElm){
    var entryContent = aElm.getElementsByClassName("entry-content");
    if(!entryContent.length) return;
    var content = entryContent[0].innerHTML;
    return content.match(new RegExp('@<a [^>]*>' + readAT.user+"<")) || content.match(new RegExp('@' + readAT.user+"([^a-zA-z0-9_]|$)"))
}
};
window.addEventListener("load", function() { readAT.init(); }, false);
window.addEventListener("unload", function() {readAT.uninit()}, false);

