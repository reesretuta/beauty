/* script for jafra chat widget. requires jquery v1.11.0 or later */

$(function(){ 

  $('#jaf_chat .jaf-chat-showhide').on('click', function() {
      $('#jaf_chat').toggleClass('shown');
  });

  $("#jaf_chat iframe").on('load',function() {
        var chatTitle = document.getElementById("jaf_chat_frame").contentDocument.title;
        console.log('chat title: '+ chatTitle);
   });

}); // end document ready function