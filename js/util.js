function printDiv(divName) {
    var w=800,h=600
    var left = (screen.width/2)-(w/2);
    var top = (screen.height/2)-(h/2);

    var printContents = new $('#'+divName).clone();
    var myWindow = window.open("", "popup", "width="+w+",height="+h+",scrollbars=yes,resizable=yes," +
        "toolbar=no,directories=no,location=no,menubar=no,status=no,left="+left+",top="+top);
    var doc = myWindow.document;

    doc.open();
    doc.write("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">");
    doc.write("<html>");
    doc.write("<body>");
    doc.write($(printContents).html());
    doc.write("</body>");
    doc.write("</html>");
    myWindow.focus();
    myWindow.print();
    myWindow.close();
}

(function ($) {
    /**
     * @function
     * @property {object} jQuery plugin which runs handler function once specified element is inserted into the DOM
     * @param {function} handler A function to execute at the time when the element is inserted
     * @param {bool} shouldRunHandlerOnce Optional: if true, handler is unbound after its first invocation
     * @example $(selector).waitUntilExists(function);
     */
 
    $.fn.waitUntilExists    = function (handler, shouldRunHandlerOnce, isChild) {
        var found       = 'found';
        var $this       = $(this.selector);
        var $elements   = $this.not(function () { return $(this).data(found); }).each(handler).data(found, true);
 
        if (!isChild)
        {
            (window.waitUntilExists_Intervals = window.waitUntilExists_Intervals || {})[this.selector] =
                window.setInterval(function () { $this.waitUntilExists(handler, shouldRunHandlerOnce, true); }, 500)
            ;
        }
        else if (shouldRunHandlerOnce && $elements.length)
        {
            window.clearInterval(window.waitUntilExists_Intervals[this.selector]);
        }
 
        return $this;
    }
}(jQuery));