var readATOption={
nativeJSON : Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON),
Branch: Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService)
		.getBranch("extensions.readalltweets."),
setAsAlreadyRead : function(){
	var str = Components.classes["@mozilla.org/supports-string;1"]
	      .createInstance(Components.interfaces.nsISupportsString);
	str.data = "{}";
	this.Branch.setComplexValue("lastStatus", 
	      Components.interfaces.nsISupportsString, str);	
}
};