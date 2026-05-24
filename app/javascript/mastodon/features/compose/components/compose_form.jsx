import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import classNames from 'classnames';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';

import { length } from 'stringz';

import { Icon }  from 'mastodon/components/icon';

import AutosuggestInput from '../../../components/autosuggest_input';
import AutosuggestTextarea from '../../../components/autosuggest_textarea';
import Button from '../../../components/button';
import EmojiPickerDropdown from '../containers/emoji_picker_dropdown_container';
import LanguageDropdown from '../containers/language_dropdown_container';
import PollButtonContainer from '../containers/poll_button_container';
import PollFormContainer from '../containers/poll_form_container';
import PrivacyDropdownContainer from '../containers/privacy_dropdown_container';
import ReplyIndicatorContainer from '../containers/reply_indicator_container';
import SpoilerButtonContainer from '../containers/spoiler_button_container';
import UploadButtonContainer from '../containers/upload_button_container';
import UploadFormContainer from '../containers/upload_form_container';
import WarningContainer from '../containers/warning_container';
import { countableText } from '../util/counter';

import CharacterCounter from './character_counter';
import LivePreview from './live_preview';

const isMathjaxifyable = str =>
  [ /\$\$([\s\S]+?)\$\$/g, /\$([\s\S]+?)\$/g, /\\\(([\s\S]+?)\\\)/g, /\\\[([\s\S]+?)\\\]/g]
    .map( r => str.match(r))
    .reduce((prev, elem) => prev || elem, false);

const allowedAroundShortCode = '><\u0085\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029\u0009\u000a\u000b\u000c\u000d';

const messages = defineMessages({
  placeholder: { id: 'compose_form.placeholder', defaultMessage: 'What is on your mind?' },
  spoiler_placeholder: { id: 'compose_form.spoiler_placeholder', defaultMessage: 'Write your warning here' },
  publish: { id: 'compose_form.publish', defaultMessage: 'Publish' },
  publishLoud: { id: 'compose_form.publish_loud', defaultMessage: '{publish}!' },
  saveChanges: { id: 'compose_form.save_changes', defaultMessage: 'Save changes' },
  showPreview: { id: 'compose_form.preview.show', defaultMessage: 'Show preview' },
  hidePreview: { id: 'compose_form.preview.hide', defaultMessage: 'Hide preview' },
  preview: { id: 'compose_form.preview', defaultMessage: 'Preview' },
  closePreview: { id: 'compose_form.preview.close', defaultMessage: 'Close preview' },
});

class ComposeForm extends ImmutablePureComponent {

  static contextTypes = {
    router: PropTypes.object,
  };

  static propTypes = {
    intl: PropTypes.object.isRequired,
    text: PropTypes.string.isRequired,
    suggestions: ImmutablePropTypes.list,
    spoiler: PropTypes.bool,
    privacy: PropTypes.string,
    spoilerText: PropTypes.string,
    focusDate: PropTypes.instanceOf(Date),
    caretPosition: PropTypes.number,
    preselectDate: PropTypes.instanceOf(Date),
    isSubmitting: PropTypes.bool,
    isChangingUpload: PropTypes.bool,
    isEditing: PropTypes.bool,
    isUploading: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onClearSuggestions: PropTypes.func.isRequired,
    onFetchSuggestions: PropTypes.func.isRequired,
    onSuggestionSelected: PropTypes.func.isRequired,
    onChangeSpoilerText: PropTypes.func.isRequired,
    onPaste: PropTypes.func.isRequired,
    onPickEmoji: PropTypes.func.isRequired,
    autoFocus: PropTypes.bool,
    anyMedia: PropTypes.bool,
    isInReply: PropTypes.bool,
    singleColumn: PropTypes.bool,
    lang: PropTypes.string,
  };

  static defaultProps = {
    autoFocus: false,
  };

  state = {
    highlighted: false,
    previewOpen: false,
    previewStyle: null,
  };

  handleChange = (e) => {
    this.props.onChange(e.target.value);
  };

  handleKeyDown = (e) => {
    if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
      this.handleSubmit();
    }
  };

  getFulltextForCharacterCounting = () => {
    return [this.props.spoiler? this.props.spoilerText: '', countableText(this.props.text)].join('');
  };

  canSubmit = () => {
    const { isSubmitting, isChangingUpload, isUploading, anyMedia } = this.props;
    const fulltext = this.getFulltextForCharacterCounting();
    const isOnlyWhitespace = fulltext.length !== 0 && fulltext.trim().length === 0;

    return !(isSubmitting || isUploading || isChangingUpload || length(fulltext) > 500 || (isOnlyWhitespace && !anyMedia));
  };

  handleSubmit = (e) => {
    if (this.props.text !== this.autosuggestTextarea.textarea.value) {
      // Something changed the text inside the textarea (e.g. browser extensions like Grammarly)
      // Update the state to match the current text
      this.props.onChange(this.autosuggestTextarea.textarea.value);
    }

    if (!this.canSubmit()) {
      return;
    }

    this.props.onSubmit(this.context.router ? this.context.router.history : null);

    if (e) {
      e.preventDefault();
    }
  };

  onSuggestionsClearRequested = () => {
    this.props.onClearSuggestions();
  };

  onSuggestionsFetchRequested = (token) => {
    this.props.onFetchSuggestions(token);
  };

  onSuggestionSelected = (tokenStart, token, value) => {
    this.props.onSuggestionSelected(tokenStart, token, value, ['text']);
  };

  onSpoilerSuggestionSelected = (tokenStart, token, value) => {
    this.props.onSuggestionSelected(tokenStart, token, value, ['spoiler_text']);
  };

  handleChangeSpoilerText = (e) => {
    this.props.onChangeSpoilerText(e.target.value);
  };

  handleFocus = () => {
    if (this.composeForm && !this.props.singleColumn) {
      const { left, right } = this.composeForm.getBoundingClientRect();
      if (left < 0 || right > (window.innerWidth || document.documentElement.clientWidth)) {
        this.composeForm.scrollIntoView();
      }
    }
  };

  componentDidMount () {
    this._updateFocusAndSelection({ });
    window.addEventListener('resize', this.schedulePreviewPlacement);
  }

  componentWillUnmount () {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.previewPlacementFrame) window.cancelAnimationFrame(this.previewPlacementFrame);
    window.removeEventListener('resize', this.schedulePreviewPlacement);
  }

  componentDidUpdate (prevProps, prevState) {
    this._updateFocusAndSelection(prevProps);

    if (this.state.previewOpen && isMathjaxifyable(prevProps.text) && !isMathjaxifyable(this.props.text)) {
      this.setState({ previewOpen: false });
    } else if (this.state.previewOpen && (prevState.previewOpen !== this.state.previewOpen || prevProps.text !== this.props.text || prevProps.spoiler !== this.props.spoiler || prevProps.spoilerText !== this.props.spoilerText)) {
      this.schedulePreviewPlacement();
    }
  }

  _updateFocusAndSelection = (prevProps) => {
    // This statement does several things:
    // - If we're beginning a reply, and,
    //     - Replying to zero or one users, places the cursor at the end of the textbox.
    //     - Replying to more than one user, selects any usernames past the first;
    //       this provides a convenient shortcut to drop everyone else from the conversation.
    if (this.props.focusDate && this.props.focusDate !== prevProps.focusDate) {
      let selectionEnd, selectionStart;

      if (this.props.preselectDate !== prevProps.preselectDate && this.props.isInReply) {
        selectionEnd   = this.props.text.length;
        selectionStart = this.props.text.search(/\s/) + 1;
      } else if (typeof this.props.caretPosition === 'number') {
        selectionStart = this.props.caretPosition;
        selectionEnd   = this.props.caretPosition;
      } else {
        selectionEnd   = this.props.text.length;
        selectionStart = selectionEnd;
      }

      // Because of the wicg-inert polyfill, the activeElement may not be
      // immediately selectable, we have to wait for observers to run, as
      // described in https://github.com/WICG/inert#performance-and-gotchas
      Promise.resolve().then(() => {
        this.autosuggestTextarea.textarea.setSelectionRange(selectionStart, selectionEnd);
        this.autosuggestTextarea.textarea.focus();
        this.setState({ highlighted: true });
        this.timeout = setTimeout(() => this.setState({ highlighted: false }), 700);
      }).catch(console.error);
    } else if(prevProps.isSubmitting && !this.props.isSubmitting) {
      this.autosuggestTextarea.textarea.focus();
    } else if (this.props.spoiler !== prevProps.spoiler) {
      if (this.props.spoiler) {
        this.spoilerText.input.focus();
      } else if (prevProps.spoiler) {
        this.autosuggestTextarea.textarea.focus();
      }
    }
  };

  setAutosuggestTextarea = (c) => {
    this.autosuggestTextarea = c;
  };

  setSpoilerText = (c) => {
    this.spoilerText = c;
  };

  setRef = c => {
    this.composeForm = c;
  };

  setPublishButtonWrapper = c => {
    this.publishButtonWrapper = c;
  };

  handleEmojiPick = (data) => {
    const { text }     = this.props;
    const position     = this.autosuggestTextarea.textarea.selectionStart;
    const needsSpace   = data.custom && position > 0 && !allowedAroundShortCode.includes(text[position - 1]);

    this.props.onPickEmoji(position, data, needsSpace);
  };

  handlePreviewToggle = () => {
    this.setState(({ previewOpen }) => ({ previewOpen: !previewOpen }), this.schedulePreviewPlacement);
  };

  handlePreviewClose = () => {
    this.setState({ previewOpen: false });
  };

  schedulePreviewPlacement = () => {
    if (this.previewPlacementFrame) {
      window.cancelAnimationFrame(this.previewPlacementFrame);
    }

    this.previewPlacementFrame = window.requestAnimationFrame(this.updatePreviewPlacement);
  };

  updatePreviewPlacement = () => {
    this.previewPlacementFrame = null;

    if (!this.state.previewOpen || !this.composeForm || !this.publishButtonWrapper) {
      return;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    if (viewportWidth < 631) {
      if (this.state.previewStyle !== null) {
        this.setState({ previewStyle: null });
      }

      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const formRect = this.composeForm.getBoundingClientRect();
    const publishRect = this.publishButtonWrapper.getBoundingClientRect();
    const margin = 8;
    const minHeight = 160;
    const width = Math.min(420, Math.max(260, Math.min(formRect.width, viewportWidth - (margin * 2))));
    const left = Math.min(Math.max(formRect.left, margin), viewportWidth - width - margin);
    const desiredTop = publishRect.bottom + margin;
    const top = Math.min(desiredTop, Math.max(margin, viewportHeight - minHeight - margin));
    const maxHeight = Math.min(360, Math.max(minHeight, viewportHeight - top - margin));
    const previewStyle = {
      '--compose-preview-bottom': 'auto',
      '--compose-preview-left': `${left}px`,
      '--compose-preview-max-height': `${maxHeight}px`,
      '--compose-preview-top': `${top}px`,
      '--compose-preview-width': `${width}px`,
    };

    if (!this.state.previewStyle || Object.keys(previewStyle).some(key => previewStyle[key] !== this.state.previewStyle[key])) {
      this.setState({ previewStyle });
    }
  };

  render () {
    const { intl, onPaste, autoFocus } = this.props;
    const { highlighted, previewOpen } = this.state;
    const disabled = this.props.isSubmitting;

    let publishText = '';

    if (this.props.isEditing) {
      publishText = intl.formatMessage(messages.saveChanges);
    } else if (this.props.privacy === 'private' || this.props.privacy === 'direct') {
      publishText = <span className='compose-form__publish-private'><Icon id='lock' /> {intl.formatMessage(messages.publish)}</span>;
    } else {
      publishText = this.props.privacy !== 'unlisted' ? intl.formatMessage(messages.publishLoud, { publish: intl.formatMessage(messages.publish) }) : intl.formatMessage(messages.publish);
    }

    const hasLivePreview = isMathjaxifyable(this.props.text);
    const previewId = 'compose-form-live-preview';
    const previewTitle = intl.formatMessage(messages.preview);
    const previewButtonTitle = intl.formatMessage(previewOpen ? messages.hidePreview : messages.showPreview);

    return (
      <form ref={this.setRef} className={classNames('compose-form', { 'compose-form--with-preview': hasLivePreview, 'compose-form--preview-open': previewOpen })} onSubmit={this.handleSubmit}>
        <WarningContainer />

        <ReplyIndicatorContainer />

        <div className='compose-form__body'>
          <div className='compose-form__editor'>
            <div className={`spoiler-input ${this.props.spoiler ? 'spoiler-input--visible' : ''}`} aria-hidden={!this.props.spoiler}>
              <AutosuggestInput
                placeholder={intl.formatMessage(messages.spoiler_placeholder)}
                value={this.props.spoilerText}
                onChange={this.handleChangeSpoilerText}
                onKeyDown={this.handleKeyDown}
                disabled={!this.props.spoiler}
                ref={this.setSpoilerText}
                suggestions={this.props.suggestions}
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                onSuggestionSelected={this.onSpoilerSuggestionSelected}
                searchTokens={[':']}
                id='cw-spoiler-input'
                className='spoiler-input__input'
                lang={this.props.lang}
                spellCheck
              />
            </div>

            <div className={classNames('compose-form__highlightable', { active: highlighted })}>
              <AutosuggestTextarea
                ref={this.setAutosuggestTextarea}
                placeholder={intl.formatMessage(messages.placeholder)}
                disabled={disabled}
                value={this.props.text}
                onChange={this.handleChange}
                suggestions={this.props.suggestions}
                onFocus={this.handleFocus}
                onKeyDown={this.handleKeyDown}
                onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                onSuggestionSelected={this.onSuggestionSelected}
                onPaste={onPaste}
                autoFocus={autoFocus}
                lang={this.props.lang}
              >
                <div className='compose-form__modifiers'>
                  <UploadFormContainer />
                  <PollFormContainer />
                </div>
              </AutosuggestTextarea>
              <EmojiPickerDropdown onPickEmoji={this.handleEmojiPick} />

              <div className='compose-form__buttons-wrapper'>
                <div className='compose-form__buttons'>
                  <UploadButtonContainer />
                  <PollButtonContainer />
                  <PrivacyDropdownContainer disabled={this.props.isEditing} />
                  <SpoilerButtonContainer />
                  <LanguageDropdown />
                  {hasLivePreview && (
                    <button
                      type='button'
                      className={classNames('icon-button', 'compose-form__preview-toggle', { active: previewOpen })}
                      title={previewButtonTitle}
                      aria-label={previewButtonTitle}
                      aria-expanded={previewOpen}
                      aria-controls={previewId}
                      onClick={this.handlePreviewToggle}
                    >
                      <Icon id={previewOpen ? 'eye-slash' : 'eye'} fixedWidth />
                    </button>
                  )}
                </div>

                <div className='character-counter__wrapper'>
                  <CharacterCounter max={500} text={this.getFulltextForCharacterCounting()} />
                </div>
              </div>
            </div>

            <div className='compose-form__publish'>
              <div className='compose-form__publish-button-wrapper' ref={this.setPublishButtonWrapper}>
                <Button
                  type='submit'
                  text={publishText}
                  disabled={!this.canSubmit()}
                  block
                />
              </div>
            </div>
          </div>

          {hasLivePreview && (
            <aside id={previewId} className={classNames('compose-form__live-preview', { 'compose-form__live-preview--open': previewOpen })} style={this.state.previewStyle} aria-label={previewTitle}>
              <div className='compose-form__live-preview-header'>
                <span>{previewTitle}</span>
                <button type='button' className='icon-button compose-form__live-preview-close' title={intl.formatMessage(messages.closePreview)} aria-label={intl.formatMessage(messages.closePreview)} onClick={this.handlePreviewClose}>
                  <Icon id='times' fixedWidth />
                </button>
              </div>
              <div className='compose-form__live-preview-scroll'>
                <LivePreview text={this.props.text} />
              </div>
            </aside>
          )}
        </div>
      </form>
    );
  }

}

export default injectIntl(ComposeForm);
