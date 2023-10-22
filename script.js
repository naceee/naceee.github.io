$(function () {
  var includes = $('[data-include]')
  $.each(includes, function () {
    var file = 'graphs/' + $(this).data('include') + '.html'
    $(this).load(file)
  })
})