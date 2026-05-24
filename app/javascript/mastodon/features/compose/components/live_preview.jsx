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

    this.setState({ textToRender: text }, () => {
      const node  = this.nodeRef.current;
      if (node && typeof MathJax !== 'undefined' && MathJax.Hub) {
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, node]);
      }
    });
  }, 375, {
    trailing: true,
  })

  componentDidMount () {
    this.changeTextToRender();
  }

  componentDidUpdate (prevProps) {
    if (prevProps.text !== this.props.text) {
      this.changeTextToRender();
    }
  }

  componentWillUnmount () {
    this.changeTextToRender.cancel();
  }

  render () {
    const text = this.state.textToRender;
    return <div ref={this.nodeRef} dangerouslySetInnerHTML={{ __html: emojify(text) }} />;
  }

}

LivePreview.propTypes = {
  text: PropTypes.string.isRequired,
};

export default LivePreview;
