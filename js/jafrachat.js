/* script for jafra chat widget. requires jquery v1.11.0 or later */

$(function(){ 

  $('#jaf_chat .jaf-chat-showhide').on('click', function() {
      $('#jaf_chat').toggleClass('shown');
  });

}); // end document ready function