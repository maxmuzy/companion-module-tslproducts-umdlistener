# TSL Products UMD Listener

This module will allow you to listen for incoming TSL UMD data from your video switcher and set tally states on your Companion Buttons.

## Configuration

- Enter the listening port that Companion should use to listen for the incoming data.
- Select whether to listen via TCP or UDP.
- Select the Protocol Version to use (TSL 3.1, TSL 4.0, or TSL 5.0)

## Actions

This module inherently has no actions. If you wish to perform an action based on a tally state change, use a Trigger.

## Variables

- Variable for each Address with UMD Label for value (address_label)
- Variable for each Address and Tally State (On/Off) (address_1, address_2, address_3, address_4)
- TSL 4.0: Color tally variables for LH/Text/RH on Display L and R (OFF/RED/GREEN/AMBER)
- TSL 5.0: RH Tally, Text Tally, LH Tally, Brightness, Reserved, Control Data

## Feedbacks

- Set button to color if address `x` Tally `y` (1-4) is this state (On/Off)
- TSL 4.0: Set button to color based on V4.0 color tally state (OFF/RED/GREEN/AMBER) for LH/Text/RH on Display L or R

## Presets

- Tally State Green/Red with Tally Label from Variable
- TSL 4.0: Color tally presets for each LH/Text/RH field on Display L and R with Red/Green/Amber styling

## Notes

- TSL 4.0 checksum validation: The module validates checksums on V4.0 packets and logs a warning on mismatch, but still processes the packet to maintain reliability in noisy broadcast environments.
