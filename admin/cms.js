/* Content admin — preview template for case studies.
   Kept in a separate file so the admin page needs no inline scripts under
   the Content-Security-Policy. */

(function () {
  'use strict';
  if (typeof CMS === 'undefined') return;

  CMS.registerPreviewStyle('../assets/css/style.css');
  CMS.registerPreviewStyle('preview.css');

  var CaseStudyPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (k) { return entry.getIn(['data', k]); };
      var image = get('image');
      var imageUrl = image ? this.props.getAsset(image).toString() : '';
      return h('main', { className: 'article preview' },
        h('header', { className: 'article__hero' },
          h('div', { className: 'container article__head' },
            h('span', { className: 'tag tag--static' }, get('category') || 'Category'),
            h('h1', { className: 'article__title' }, get('title') || 'Title'),
            h('p', { className: 'article__excerpt' }, get('excerpt') || ''),
            h('dl', { className: 'article__meta' },
              h('div', {}, h('dt', {}, 'By'), h('dd', {}, get('author') || 'Quantact Partners')),
              h('div', {}, h('dt', {}, 'Published'), h('dd', {}, String(get('date') || '').slice(0, 10)))
            )
          ),
          imageUrl ? h('figure', { className: 'article__figure container' }, h('img', { src: imageUrl, alt: get('image_alt') || '' })) : null
        ),
        h('div', { className: 'container article__layout' },
          h('article', { className: 'article__body glass' }, this.props.widgetFor('body'))
        )
      );
    }
  });
  CMS.registerPreviewTemplate('case_studies', CaseStudyPreview);
})();
