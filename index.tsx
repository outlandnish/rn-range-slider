import React, {
  memo,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
  ViewProps,
  LayoutChangeEvent
} from 'react-native';

import styles from './styles';
import {
  useThumbFollower,
  useLowHigh,
  useWidthLayout,
  useLabelContainerProps,
  useSelectedRail,
} from './hooks';
import {clamp, getValueForPosition, isLowCloser} from './helpers';

const trueFunc = () => true;
const falseFunc = () => false;

export interface SliderProps extends ViewProps {
  min: number;
  max: number;
  minRange?: number;
  step: number;
  renderThumb: (name: 'high' | 'low') => ReactNode;
  low?: number;
  high?: number;
  allowLabelOverflow?: boolean;
  disableRange?: boolean;
  disabled?: boolean;
  floatingLabel?: boolean;
  renderLabel?: (value: number) => ReactNode;
  renderNotch?: (value: number) => ReactNode;
  renderRail: () => ReactNode;
  renderRailSelected: () => ReactNode;
  onValueChanged?: (low: number, high: number, byUser: boolean) => void;
  onSliderTouchStart?: (low: number, high: number) => void;
  onSliderTouchEnd?: (low: number, high: number) => void;
}

const Slider: React.FC<SliderProps> = ({
  min,
  max,
  minRange = 0,
  step,
  low: lowProp,
  high: highProp,
  floatingLabel = false,
  allowLabelOverflow = false,
  disableRange = false,
  disabled = false,
  onValueChanged,
  onSliderTouchStart,
  onSliderTouchEnd,
  renderThumb,
  renderLabel,
  renderNotch,
  renderRail,
  renderRailSelected,
  ...restProps
}) => {
  const {inPropsRef, inPropsRefPrev, setLow, setHigh} = useLowHigh(
    lowProp,
    disableRange ? max : highProp,
    min,
    max,
    step,
  );
  const lowThumbXRef = useRef(new Animated.Value(0));
  const highThumbXRef = useRef(new Animated.Value(0));
  const pointerX = useRef(new Animated.Value(0)).current;
  const {current: lowThumbX} = lowThumbXRef;
  const {current: highThumbX} = highThumbXRef;

  const gestureStateRef = useRef({isLow: true, lastValue: 0, lastPosition: 0});
  const [isPressed, setPressed] = useState(false);

  const containerWidthRef = useRef(0);
  const [thumbWidth, setThumbWidth] = useState(0);

  const [selectedRailStyle, updateSelectedRail] = useSelectedRail(
    inPropsRef,
    containerWidthRef,
    thumbWidth,
    disableRange,
  );

  const updateThumbs = useCallback(() => {
    const {current: containerWidth} = containerWidthRef;
    if (!thumbWidth || !containerWidth) {
      return;
    }
    const {low, high} = inPropsRef.current;
    if (!disableRange) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const {current: highThumbX} = highThumbXRef;
      const highPosition =
        ((high - min) / (max - min)) * (containerWidth - thumbWidth);
      highThumbX.setValue(highPosition);
    }
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const {current: lowThumbX} = lowThumbXRef;
    const lowPosition =
      ((low - min) / (max - min)) * (containerWidth - thumbWidth);
    lowThumbX.setValue(lowPosition);
    if (typeof updateSelectedRail === 'function') {
      updateSelectedRail();
    }
    onValueChanged?.(low, high, false);
  }, [
    disableRange,
    inPropsRef,
    max,
    min,
    onValueChanged,
    thumbWidth,
    updateSelectedRail,
  ]);

  useEffect(() => {
    const {lowPrev, highPrev} = inPropsRefPrev;
    if (
      (lowProp !== undefined && lowProp !== lowPrev) ||
      (highProp !== undefined && highProp !== highPrev)
    ) {
      updateThumbs();
    }
  }, [
    highProp,
    inPropsRefPrev.lowPrev,
    inPropsRefPrev.highPrev,
    lowProp,
    inPropsRefPrev,
    updateThumbs,
  ]);

  useEffect(() => {
    updateThumbs();
  }, [updateThumbs]);

  const handleContainerLayout = useWidthLayout(containerWidthRef, updateThumbs);
  const handleThumbLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {
        layout: {width},
      } = event.nativeEvent;
      if (thumbWidth !== width) {
        setThumbWidth(width);
      }
    },
    [thumbWidth],
  );

  const lowStyles = useMemo(
    () => ({transform: [{translateX: lowThumbX}]}),
    [lowThumbX]);

  const highStyles = useMemo(
    () => disableRange ? null : [styles.highThumbContainer, {transform: [{translateX: highThumbX}]}],
    [disableRange, highThumbX]);

  const railContainerStyles = useMemo(
    () => [styles.railsContainer, {marginHorizontal: thumbWidth / 2}],
    [thumbWidth]);

  const [labelView, labelUpdate] = useThumbFollower(
    containerWidthRef,
    gestureStateRef,
    renderLabel,
    isPressed,
    allowLabelOverflow,
  );
  const [notchView, notchUpdate] = useThumbFollower(
    containerWidthRef,
    gestureStateRef,
    renderNotch,
    isPressed,
    allowLabelOverflow,
  );
  const lowThumb = renderThumb('low');
  const highThumb = renderThumb('high');

  const labelContainerProps = useLabelContainerProps(floatingLabel);

  const {panHandlers} = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: trueFunc,
        onMoveShouldSetPanResponderCapture: falseFunc,
        onPanResponderTerminationRequest: falseFunc,
        onPanResponderTerminate: trueFunc,
        onShouldBlockNativeResponder: trueFunc,

        onMoveShouldSetPanResponder: (
          evt: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => Math.abs(gestureState.dx) > 2 * Math.abs(gestureState.dy),

        onPanResponderGrant: ({nativeEvent}, gestureState) => {
          if (disabled) {
            return;
          }
          const {numberActiveTouches} = gestureState;
          if (numberActiveTouches > 1) {
            return;
          }
          setPressed(true);
          // eslint-disable-next-line @typescript-eslint/no-shadow
          const {current: lowThumbX} = lowThumbXRef;
          // eslint-disable-next-line @typescript-eslint/no-shadow
          const {current: highThumbX} = highThumbXRef;
          const {locationX: downX, pageX} = nativeEvent;
          const containerX = pageX - downX;

          // eslint-disable-next-line @typescript-eslint/no-shadow
          const {low, high, min, max} = inPropsRef.current;
          onSliderTouchStart?.(low, high);
          const containerWidth = containerWidthRef.current;

          const lowPosition =
            thumbWidth / 2 +
            ((low - min) / (max - min)) * (containerWidth - thumbWidth);
          const highPosition =
            thumbWidth / 2 +
            ((high - min) / (max - min)) * (containerWidth - thumbWidth);

          const isLow =
            disableRange || isLowCloser(downX, lowPosition, highPosition);
          gestureStateRef.current.isLow = isLow;

          const handlePositionChange = (positionInView: number) => {
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const {low, high, min, max, step} = inPropsRef.current;
            const minValue = isLow ? min : low + minRange;
            const maxValue = isLow ? high - minRange : max;
            const value = clamp(
              getValueForPosition(
                positionInView,
                containerWidth,
                thumbWidth,
                min,
                max,
                step,
              ),
              minValue,
              maxValue,
            );
            if (gestureStateRef.current.lastValue === value) {
              return;
            }
            const availableSpace = containerWidth - thumbWidth;
            const absolutePosition =
              ((value - min) / (max - min)) * availableSpace;
            gestureStateRef.current.lastValue = value;
            gestureStateRef.current.lastPosition =
              absolutePosition + thumbWidth / 2;
            (isLow ? lowThumbX : highThumbX).setValue(absolutePosition);
            onValueChanged?.(isLow ? value : low, isLow ? high : value, true);
            (isLow ? setLow : setHigh)(value);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            labelUpdate && labelUpdate(gestureStateRef.current.lastPosition, value);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            notchUpdate && notchUpdate(gestureStateRef.current.lastPosition, value);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            updateSelectedRail();
          };
          handlePositionChange(downX);
          pointerX.removeAllListeners();
          pointerX.addListener(({value: pointerPosition}) => {
            const positionInView = pointerPosition - containerX;
            handlePositionChange(positionInView);
          });
        },

        onPanResponderMove: disabled
          ? undefined
          : Animated.event([null, {moveX: pointerX}], {useNativeDriver: false}),

        onPanResponderRelease: () => {
          setPressed(false);
          const {low, high} = inPropsRef.current;
          onSliderTouchEnd?.(low, high);
        },
      }),
    [
      disabled,
      pointerX,
      inPropsRef,
      onSliderTouchStart,
      thumbWidth,
      disableRange,
      minRange,
      onValueChanged,
      setLow,
      setHigh,
      labelUpdate,
      notchUpdate,
      updateSelectedRail,
      onSliderTouchEnd,
    ],
  );

  return (
    <View {...restProps}>
      <View {...labelContainerProps}>
        <>
        {labelView}
        {notchView}
        </>
      </View>
      <View onLayout={handleContainerLayout} style={styles.controlsContainer}>
        <View style={railContainerStyles}>
          {renderRail()}
          <Animated.View style={selectedRailStyle}>
            {renderRailSelected()}
          </Animated.View>
        </View>
        <Animated.View style={lowStyles} onLayout={handleThumbLayout}>
          {lowThumb}
        </Animated.View>
        {!disableRange && (
          <Animated.View style={highStyles}>{highThumb}</Animated.View>
        )}
        <View
          {...panHandlers}
          style={styles.touchableArea}
          collapsable={false}
        />
      </View>
    </View>
  );
};

export default memo(Slider);
