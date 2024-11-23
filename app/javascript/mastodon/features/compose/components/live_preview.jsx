import PropTypes from 'prop-types';
import React from 'react';

import { debounce } from 'lodash';

import emojify from '../../emoji/emoji';


/* global MathJax */
// const loadScriptOnce = require('load-script-once');

class LivePreview extends React.PureComponent {

  constructor (props, context) {
    super(props, context);
    this.nodeRef = React.createRef();
    this.state = {
      textToRender: '',
    };
  }

  changeTextToRender = debounce(() => {
    const text = this.props.text.replace(/\n/g, '<br>');

    this.setState({ textToRender: text });
    this.render();
    const node  = this.nodeRef.current;
    if (MathJax !== undefined) {
      MathJax.Hub.Queue(['Typeset', MathJax.Hub, node]);
    }
  }, 375, {
    trailing: true,
  })

  componentWillUpdate() {
  }

  componentDidUpdate() {
    this.changeTextToRender();
  }

  render () {
    const text = this.state.textToRender;
    return <div dangerouslySetInnerHTML={{ __html: emojify(text) }} />;
  }

}

LivePreview.propTypes = {
  text: PropTypes.string.isRequired,
};

export default LivePreview;
