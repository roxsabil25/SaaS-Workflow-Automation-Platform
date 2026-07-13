import React from 'react';
import EditorPlaceholder from '../../EditorPlaceholder';

/**
 * UnifiedTextEditor - Safe Wrapper
 * 
 * This is a stripped-down version of the UnifiedTextEditor that replaces
 * the sensitive editor engine with a safe placeholder for development handovers.
 */
const UnifiedTextEditor = ({ mode = 'preview', isDocument = false, ...props }) => {
  return <EditorPlaceholder mode={mode} isDocument={isDocument} {...props} />;
};

export default UnifiedTextEditor;
