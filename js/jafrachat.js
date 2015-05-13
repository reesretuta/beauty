/* script for jafra chat widget. requires jquery v1.11.0 or later */

$('#jaf_chat').waitUntilExists(function() {
    $('#jaf_chat .jaf-chat-showhide').on('click', function() {
        $('#jaf_chat').toggleClass('shown');
    });
}, false);