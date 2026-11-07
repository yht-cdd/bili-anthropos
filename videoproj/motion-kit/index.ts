/**
 * motion-kit 的统一入口。
 *
 * 别的工程里这样用（相对路径，本仓库内不需要装包）：
 *   import { PushIn, Stagger, Grain } from '../../motion-kit';
 * 曲线要自己写动效时：
 *   import { progress, expoOut } from '../../motion-kit/easings';
 */
export * from './easings';
export * from './Motion';
