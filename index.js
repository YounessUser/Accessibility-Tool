$(document).ready(function () {
    $("#lighthouse").click(function () {
        const urls = $("#urls").val().split(',');
        const result = $("#result");

        
   //      $.ajax({
   //       url: '/lighthousee',
   //       type: 'post',
   //       dataType: 'json',
   //       contentType: 'application/json',
   //       success: function (data) {
   //          console.log("done");
   //       },
   //       data: JSON.stringify(urls)
   //   });

     
       $.post("/lighthousee",
          {
             urls: urls
          },
          function (data, status) {
             console.log("done");
          });
    });
 });