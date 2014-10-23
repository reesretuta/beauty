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